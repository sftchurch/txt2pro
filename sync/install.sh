#!/usr/bin/env bash
# Build txt2pro-sync, install it as a per-user launchd LaunchAgent that runs at
# login/boot and every couple of minutes. Re-run any time to update.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
LABEL="com.sftchurch.txt2pro-sync"
BIN_DIR="$HOME/Library/Application Support/txt2pro-sync"
BIN="$BIN_DIR/txt2pro-sync"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/txt2pro-sync.log"

# ---- configuration (override by exporting before running) -------------------
API="${TXT2PRO_API:-https://txt2pro.sft-church.workers.dev}"
DEST="${TXT2PRO_DEST:-$HOME/Documents/txt2pro}"
OPEN="${TXT2PRO_OPEN:-0}"        # 1 = open each new bundle in ProPresenter
INTERVAL="${TXT2PRO_INTERVAL:-120}"  # seconds between checks while logged in
# -----------------------------------------------------------------------------

if ! command -v cargo >/dev/null 2>&1; then
  echo "error: Rust/cargo not found. Install from https://rustup.rs and re-run." >&2
  exit 1
fi

echo "Building (cargo build --release)…"
( cd "$HERE" && cargo build --release )

mkdir -p "$BIN_DIR" "$HOME/Library/LaunchAgents" "$DEST"
cp "$HERE/target/release/txt2pro-sync" "$BIN"
chmod +x "$BIN"

echo "Writing LaunchAgent → $PLIST"
cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>$BIN</string></array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>TXT2PRO_API</key><string>$API</string>
    <key>TXT2PRO_DEST</key><string>$DEST</string>
    <key>TXT2PRO_OPEN</key><string>$OPEN</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>StartInterval</key><integer>$INTERVAL</integer>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
PLISTEOF

echo "Loading…"
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load -w "$PLIST"

echo ""
echo "✓ Installed."
echo "  Bundles sync to : $DEST/<service>/"
echo "  Checks every    : ${INTERVAL}s  (+ on every login/boot)"
echo "  Logs            : $LOG"
echo "  Open in PP       : $([ "$OPEN" = 1 ] && echo yes || echo no)  (set TXT2PRO_OPEN=1 and re-run to enable)"
echo ""
echo "Run a check right now:  \"$BIN\""
