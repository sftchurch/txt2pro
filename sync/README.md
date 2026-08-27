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
3. Save it (atomically — staged in the agent's state dir, then renamed into
   place, so neither ProPresenter nor iCloud ever sees a half-written bundle;
   `~/Documents` on the church Mac is iCloud-synced and temp files renamed
   inside a synced folder can leave Finder showing stale contents) to
   `~/Documents/txt2pro/<Service Title>/`:
   - `<date>_v<version>.proBundle` — the versioned copy (history)
   - `current.proBundle` — always the newest, stable path. Recurring titles
     ("Friday Service") share a folder, so only the newest service of a title
     (by service date, then publish time) may write it — otherwise a fresh
     sync could overwrite it with last week's bundle.
4. Refresh **`~/Desktop/Today's Service/`** (override with `TXT2PRO_TODAY`):
   always exactly one bundle — the service dated today, else the next
   upcoming, else the most recent past. On a Friday the Friday bundle stays
   there even if Sunday's was published later; the interval run flips it
   automatically when the day changes. This is the folder volunteers open.
5. Record the new checksum in a state file, write `status.json` (consumed by
   the SwiftBar menu bar plugin, below) and show a notification.

HTTP calls have bounded timeouts (10s connect / 120s total) so a flaky network
can't hang a run. No website changes are needed — these endpoints already exist.

## "Sync now" button (mid-service refetch)

`install.sh` drops a double-clickable **`Sync txt2pro.command`** on the Desktop.
Double-click it to pull the latest bundles immediately instead of waiting for the
next interval — it also **opens each new bundle in ProPresenter** for a one-click
import. Use it if you re-publish a change during setup or mid-service.

## Menu bar status (SwiftBar)

`txt2prosync.30s.py` is a SwiftBar plugin for the church Mac (which already
runs SwiftBar for the Canva announcements sync). It shows a music-note icon
(warning triangle if a sync failed or the agent stopped checking), and its
menu has the last check time, the newest downloaded bundle, **Sync Now**
(pulls immediately and opens new bundles in ProPresenter), **Open Bundles
Folder**, and **View Log**. Install it into the SwiftBar plugins folder
alongside a small wrapper at `~/Library/Scripts/txt2pro-sync-now.sh` that
runs the agent with `TXT2PRO_OPEN=1`.

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
| `TXT2PRO_INTERVAL`| `60`                                             | Seconds between checks while logged in    |
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
