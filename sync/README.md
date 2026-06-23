# txt2pro-sync

A tiny macOS agent that mirrors the latest published `.proBundle` for every
service onto the ProPresenter Mac, so you never hand-download and hunt for files
before a service.

It runs as a per-user **launchd LaunchAgent** (the macOS equivalent of a systemd
unit): once at **login/boot** — covering the "boot the Mac right before service"
window — and on a short **interval** while logged in, so a re-publish during
setup is picked up too. It only downloads when a service's checksum actually
changed, and posts a macOS notification when it does.

## What it does each run

1. `GET /api/services` — the list of services with their latest `checksum`.
2. For any service whose checksum differs from the last sync, download
   `GET /api/services/<id>/latest/download`.
3. Save it to `~/Documents/txt2pro/<Service Title>/`:
   - `<date>_v<version>.proBundle` — the versioned copy (history)
   - `current.proBundle` — always the newest, stable path
4. Record the new checksum in a state file and show a notification.

No website changes are needed — these endpoints already exist.

## Install

Requires Rust (`https://rustup.rs`). On the ProPresenter Mac:

```sh
cd sync
./install.sh
```

That builds the binary, installs it to
`~/Library/Application Support/txt2pro-sync/`, writes the LaunchAgent, and loads
it. Re-run `./install.sh` any time to update or change config.

## Configure

Override defaults by exporting before running `install.sh` (they're baked into
the LaunchAgent):

| Variable          | Default                                          | Meaning                                   |
|-------------------|--------------------------------------------------|-------------------------------------------|
| `TXT2PRO_API`     | `https://txt2pro.sft-church.workers.dev`         | API base URL                              |
| `TXT2PRO_DEST`    | `~/Documents/txt2pro`                            | Where bundles are mirrored                |
| `TXT2PRO_INTERVAL`| `120`                                            | Seconds between checks while logged in    |
| `TXT2PRO_OPEN`    | `0`                                              | `1` = open each new bundle in ProPresenter for one-click import |

Example — enable auto-open and check every 60s:

```sh
TXT2PRO_OPEN=1 TXT2PRO_INTERVAL=60 ./install.sh
```

## Run / inspect / remove

```sh
# run a check immediately (also fine for testing)
"$HOME/Library/Application Support/txt2pro-sync/txt2pro-sync"

# logs
tail -f "$HOME/Library/Logs/txt2pro-sync.log"

# stop & remove the agent (keeps downloads)
./uninstall.sh
```

## Notes / limits

- **ProPresenter can't be scripted to drop a bundle straight into a playlist.**
  Its API is read/trigger only — there's no import endpoint. So this agent gets
  the bundle onto the Mac (optionally opening it for a one-click import); the
  final drop into the Sunday/Friday playlist is still a manual step in
  ProPresenter.
- The agent **polls**. The Mac has no public address and is usually off, so the
  server can't push to it; a check at boot is required regardless. Polling a tiny
  JSON endpoint every couple of minutes is effectively free. (A real-time "wake"
  channel is possible later — see the project notes.)
- State lives in
  `~/Library/Application Support/txt2pro-sync/state.json`. Delete it to force a
  full re-download on the next run.
