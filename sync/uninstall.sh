#!/usr/bin/env bash
# Stop and remove the txt2pro-sync LaunchAgent. Leaves downloaded bundles in place.
set -euo pipefail

LABEL="com.sftchurch.txt2pro-sync"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

launchctl unload "$PLIST" 2>/dev/null || true
rm -f "$PLIST"
rm -f "$HOME/Desktop/Sync txt2pro.command"

echo "✓ Removed $LABEL."
echo "  Downloaded bundles and the binary were left in place."
echo "  To remove those too:"
echo "    rm -rf \"$HOME/Library/Application Support/txt2pro-sync\""
echo "    rm -rf \"$HOME/Documents/txt2pro\"   # WARNING: deletes synced bundles"
