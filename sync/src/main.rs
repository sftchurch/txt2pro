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
use std::time::{Duration, SystemTime, UNIX_EPOCH};

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
    #[serde(default)]
    published_at: Option<String>,
}

struct Config {
    api: String,
    dest: PathBuf,
    today_dir: PathBuf,
    state_dir: PathBuf,
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
    // One always-visible folder holding exactly one bundle: today's service
    // (or the next upcoming one). Volunteers open this, not the archive.
    let today_dir = std::env::var("TXT2PRO_TODAY")
        .map(PathBuf::from)
        .unwrap_or_else(|_| home().join("Desktop/Today's Service"));
    let state_dir = home().join("Library/Application Support/txt2pro-sync");
    let state_file = state_dir.join("state.json");
    // TXT2PRO_OPEN=1 → open each new bundle in ProPresenter for one-click import
    let open = matches!(std::env::var("TXT2PRO_OPEN").as_deref(), Ok("1") | Ok("true"));
    let notify = !matches!(std::env::var("TXT2PRO_NOTIFY").as_deref(), Ok("0") | Ok("false"));
    Config { api, dest, today_dir, state_dir, state_file, open, notify }
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

/// Write atomically: stage OUTSIDE the destination folder, then rename into
/// place. The destination may be iCloud-synced (~/Documents on the church
/// Mac), and a temp file appearing and renaming inside a synced folder can
/// leave its indexer showing stale contents in Finder — and neither iCloud
/// nor ProPresenter should ever see a partial bundle. Staging dir and dest
/// are on the same APFS volume, so the rename stays atomic.
fn write_atomic(staging_dir: &Path, path: &Path, bytes: &[u8]) -> Result<(), Box<dyn Error>> {
    fs::create_dir_all(staging_dir)?;
    let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("bundle");
    let tmp = staging_dir.join(format!("{name}.part"));
    fs::write(&tmp, bytes)?;
    fs::rename(&tmp, path)?;
    Ok(())
}

/// Small machine-readable status for the menu bar plugin, written atomically.
/// Keeps the last successful download info across runs that download nothing.
fn write_status(state_dir: &Path, ok: bool, error: Option<&str>, new: &[String], today: Option<&str>) {
    let path = state_dir.join("status.json");
    let prev: serde_json::Value = fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let (last_new, last_new_at) = if new.is_empty() {
        (
            prev.get("last_new").cloned().unwrap_or_else(|| serde_json::json!([])),
            prev.get("last_new_at").cloned().unwrap_or(serde_json::Value::Null),
        )
    } else {
        (serde_json::json!(new), serde_json::json!(now))
    };
    let today_val = match today {
        Some(t) => serde_json::json!(t),
        None => prev.get("today").cloned().unwrap_or(serde_json::Value::Null),
    };
    let status = serde_json::json!({
        "last_check_at": now,
        "ok": ok,
        "error": error,
        "last_new": last_new,
        "last_new_at": last_new_at,
        "today": today_val,
    });
    let _ = fs::create_dir_all(state_dir);
    let tmp = path.with_extension("json.tmp");
    if fs::write(&tmp, status.to_string()).is_ok() {
        let _ = fs::rename(&tmp, &path);
    }
}

fn today_local() -> Option<String> {
    // Local calendar date. `date +%F` respects the Mac's timezone/DST,
    // which pure-epoch arithmetic wouldn't.
    let out = Command::new("date").arg("+%F").output().ok()?;
    let s = String::from_utf8(out.stdout).ok()?.trim().to_string();
    if s.len() == 10 { Some(s) } else { None }
}

/// Keep the Today's Service folder holding exactly one bundle: the service
/// dated today, else the next upcoming one, else the most recent past one.
/// So on a Friday the Friday bundle stays current even if Sunday's was
/// published later; at midnight the next run flips it to the new day.
/// Returns a human label for the status file when a bundle is in place.
fn update_today(
    cfg: &Config,
    services: &[Service],
    state: &mut BTreeMap<String, String>,
) -> Option<String> {
    let today = today_local()?;
    let pubs: Vec<&Service> = services
        .iter()
        .filter(|s| s.current_version > 0 && s.checksum.is_some() && s.service_date.is_some())
        .collect();
    let upcoming = pubs
        .iter()
        .filter(|s| s.service_date.as_deref().unwrap() >= today.as_str())
        .min_by(|a, b| {
            a.service_date
                .cmp(&b.service_date)
                .then(b.published_at.cmp(&a.published_at))
        });
    let pick = *upcoming.or_else(|| {
        pubs.iter().max_by(|a, b| {
            a.service_date
                .cmp(&b.service_date)
                .then(a.published_at.cmp(&b.published_at))
        })
    })?;

    let title = pick.title.as_deref().unwrap_or("untitled");
    let date = pick.service_date.as_deref().unwrap();
    let fname = format!("{} {}.proBundle", sanitize(title), date);
    let label = format!("{} ({})", title, date);
    let marker = format!("{}:{}:{}", pick.id, pick.checksum.as_deref().unwrap(), fname);
    if state.get("__today").map(String::as_str) == Some(marker.as_str()) {
        return Some(label);
    }

    // Copy from the mirror; if it isn't mirrored yet (download failed this
    // run), leave things as they are and let the next run retry.
    let src = cfg
        .dest
        .join(sanitize(title))
        .join(format!("{}_v{}.proBundle", date, pick.current_version));
    let bytes = fs::read(&src).ok()?;
    let staging = cfg.state_dir.join("staging");
    if let Err(e) = fs::create_dir_all(&cfg.today_dir)
        .map_err(Box::<dyn Error>::from)
        .and_then(|_| write_atomic(&staging, &cfg.today_dir.join(&fname), &bytes))
    {
        eprintln!("[txt2pro-sync] today's-service update failed: {}", e);
        return None;
    }
    if let Ok(entries) = fs::read_dir(&cfg.today_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name != fname && name.to_lowercase().ends_with(".probundle") {
                let _ = fs::remove_file(entry.path());
            }
        }
    }
    state.insert("__today".into(), marker);
    println!("[txt2pro-sync] today's bundle → {}", cfg.today_dir.join(&fname).display());
    if cfg.notify {
        notify("txt2pro · today's service ready", &label);
    }
    Some(label)
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

    // Recurring titles ("Friday Service") share a folder, so only the newest
    // service of each title may own current.proBundle — otherwise a fresh
    // sync (empty state file) lets an older week overwrite the stable
    // pointer, since the API lists newest first and the loop writes last.
    let mut newest: BTreeMap<String, (String, String)> = BTreeMap::new();
    for svc in &resp.services {
        if svc.current_version <= 0 || svc.checksum.is_none() {
            continue;
        }
        let key = sanitize(svc.title.as_deref().unwrap_or("untitled"));
        let mark = (
            svc.service_date.clone().unwrap_or_default(),
            svc.published_at.clone().unwrap_or_default(),
        );
        match newest.get(&key) {
            Some(cur) if *cur >= mark => {}
            _ => {
                newest.insert(key, mark);
            }
        }
    }

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

        let staging = cfg.state_dir.join("staging");
        let versioned = folder.join(format!("{}_v{}.proBundle", date, svc.current_version));
        write_atomic(&staging, &versioned, &bytes)?;
        // A stable filename always pointing at the newest bundle for this
        // title — but only the newest service of the title may write it.
        let mark = (
            svc.service_date.clone().unwrap_or_default(),
            svc.published_at.clone().unwrap_or_default(),
        );
        if newest.get(&sanitize(title)) == Some(&mark) {
            write_atomic(&staging, &folder.join("current.proBundle"), &bytes)?;
        }

        state.insert(svc.id.clone(), checksum.to_string());
        downloaded.push(format!("{} v{}", title, svc.current_version));
        println!("[txt2pro-sync] saved {}", versioned.display());

        if cfg.open {
            let _ = Command::new("open").arg("-a").arg("ProPresenter").arg(&versioned).status();
        }
    }

    let today_label = update_today(&cfg, &resp.services, &mut state);
    save_state(&cfg.state_file, &state)?;
    write_status(&cfg.state_dir, true, None, &downloaded, today_label.as_deref());

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
        write_status(&config().state_dir, false, Some(&e.to_string()), &[], None);
        std::process::exit(1);
    }
}
