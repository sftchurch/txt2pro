//! txt2pro-sync — pulls the latest published .proBundle for every service and
//! mirrors them into ~/Documents/txt2pro/<service>/ on the ProPresenter Mac.
//!
//! Designed to be run one-shot by a launchd LaunchAgent: once at login/boot
//! (RunAtLoad) and on an interval (StartInterval). It keeps a small state file
//! of the last-seen checksum per service, so it only downloads when something
//! actually changed, and posts a macOS notification when it does.

use std::collections::BTreeMap;
use std::error::Error;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;

use serde::Deserialize;

#[derive(Deserialize)]
struct ServicesResp {
    services: Vec<Service>,
}

#[derive(Deserialize)]
struct Service {
    id: String,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    service_date: Option<String>,
    #[serde(default)]
    current_version: i64,
    #[serde(default)]
    checksum: Option<String>,
}

struct Config {
    api: String,
    dest: PathBuf,
    state_file: PathBuf,
    open: bool,
    notify: bool,
}

fn home() -> PathBuf {
    PathBuf::from(std::env::var("HOME").unwrap_or_else(|_| ".".into()))
}

fn config() -> Config {
    let api = std::env::var("TXT2PRO_API")
        .unwrap_or_else(|_| "https://txt2pro.sft-church.workers.dev".into());
    let dest = std::env::var("TXT2PRO_DEST")
        .map(PathBuf::from)
        .unwrap_or_else(|_| home().join("Documents/txt2pro"));
    let state_file = home().join("Library/Application Support/txt2pro-sync/state.json");
    // TXT2PRO_OPEN=1 → open each new bundle in ProPresenter for one-click import
    let open = matches!(std::env::var("TXT2PRO_OPEN").as_deref(), Ok("1") | Ok("true"));
    let notify = !matches!(std::env::var("TXT2PRO_NOTIFY").as_deref(), Ok("0") | Ok("false"));
    Config { api, dest, state_file, open, notify }
}

/// Make a title safe to use as a folder name.
fn sanitize(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == ' ' || c == '-' || c == '_' { c } else { '_' })
        .collect();
    let trimmed = cleaned.trim().trim_matches('.').trim();
    if trimmed.is_empty() { "untitled".to_string() } else { trimmed.to_string() }
}

fn load_state(path: &Path) -> BTreeMap<String, String> {
    fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_state(path: &Path, state: &BTreeMap<String, String>) -> Result<(), Box<dyn Error>> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)?;
    }
    fs::write(path, serde_json::to_string_pretty(state)?)?;
    Ok(())
}

fn get_string(agent: &ureq::Agent, url: &str) -> Result<String, Box<dyn Error>> {
    Ok(agent.get(url).call()?.into_string()?)
}

fn download(agent: &ureq::Agent, url: &str) -> Result<Vec<u8>, Box<dyn Error>> {
    let mut buf = Vec::new();
    agent.get(url).call()?.into_reader().read_to_end(&mut buf)?;
    Ok(buf)
}

/// Write atomically: stage to a temp file, then rename into place, so a reader
/// (ProPresenter, or the operator) never sees a half-downloaded bundle.
fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), Box<dyn Error>> {
    let tmp = path.with_extension("proBundle.part");
    fs::write(&tmp, bytes)?;
    fs::rename(&tmp, path)?;
    Ok(())
}

fn notify(title: &str, msg: &str) {
    // AppleScript string literals use the same backslash escaping as Rust's {:?}
    let script = format!("display notification {:?} with title {:?}", msg, title);
    let _ = Command::new("osascript").arg("-e").arg(script).status();
}

fn run() -> Result<(), Box<dyn Error>> {
    let cfg = config();
    fs::create_dir_all(&cfg.dest)?;

    // Bounded timeouts so a flaky church network can never hang a run
    let agent = ureq::AgentBuilder::new()
        .timeout_connect(Duration::from_secs(10))
        .timeout(Duration::from_secs(120))
        .build();

    let body = get_string(&agent, &format!("{}/api/services", cfg.api))?;
    let resp: ServicesResp = serde_json::from_str(&body)?;

    let mut state = load_state(&cfg.state_file);
    let mut downloaded: Vec<String> = Vec::new();

    for svc in &resp.services {
        // Skip services that have never been published or have no checksum yet
        if svc.current_version <= 0 {
            continue;
        }
        let Some(checksum) = svc.checksum.as_deref() else { continue };

        // Already have this exact version mirrored?
        if state.get(&svc.id).map(String::as_str) == Some(checksum) {
            continue;
        }

        let title = svc.title.as_deref().unwrap_or("untitled");
        let date = svc.service_date.as_deref().unwrap_or("undated");
        let folder = cfg.dest.join(sanitize(title));
        fs::create_dir_all(&folder)?;

        let url = format!("{}/api/services/{}/latest/download", cfg.api, svc.id);
        let bytes = match download(&agent, &url) {
            Ok(b) => b,
            Err(e) => {
                eprintln!("[txt2pro-sync] download failed for {} ({}): {}", title, svc.id, e);
                continue; // leave state unchanged so we retry next run
            }
        };

        let versioned = folder.join(format!("{}_v{}.proBundle", date, svc.current_version));
        write_atomic(&versioned, &bytes)?;
        // A stable filename always pointing at the newest bundle for this service
        write_atomic(&folder.join("current.proBundle"), &bytes)?;

        state.insert(svc.id.clone(), checksum.to_string());
        downloaded.push(format!("{} v{}", title, svc.current_version));
        println!("[txt2pro-sync] saved {}", versioned.display());

        if cfg.open {
            let _ = Command::new("open").arg("-a").arg("ProPresenter").arg(&versioned).status();
        }
    }

    save_state(&cfg.state_file, &state)?;

    if !downloaded.is_empty() && cfg.notify {
        let msg = if downloaded.len() == 1 {
            downloaded[0].clone()
        } else {
            format!("{} bundles updated", downloaded.len())
        };
        notify("txt2pro · new bundle ready", &msg);
    }

    Ok(())
}

fn main() {
    if let Err(e) = run() {
        eprintln!("[txt2pro-sync] error: {}", e);
        std::process::exit(1);
    }
}
