#!/usr/bin/env python3
# <bitbar.title>Service Bundles Sync</bitbar.title>
# <swiftbar.hideAbout>true</swiftbar.hideAbout>
# <swiftbar.hideRunInTerminal>true</swiftbar.hideRunInTerminal>
# <swiftbar.hideLastUpdated>true</swiftbar.hideLastUpdated>
# <swiftbar.hideDisablePlugin>true</swiftbar.hideDisablePlugin>
# <swiftbar.hideSwiftBar>true</swiftbar.hideSwiftBar>
#
# SwiftBar plugin: menu bar status for txt2pro-sync (service .proBundle
# mirroring). Reads the status.json the sync agent writes each run.
# Install to the SwiftBar plugins folder alongside the canva-sync plugin.
import json
import os
import time
from datetime import datetime

HOME = os.environ.get("HOME", "/Users/propresenter")
STATUS = os.path.join(HOME, "Library/Application Support/txt2pro-sync/status.json")
STALE_S = 300  # agent runs every 60s; older than this means it's not running


def fmt_when(epoch):
    d = datetime.fromtimestamp(epoch)
    hour = d.strftime("%I").lstrip("0") or "12"
    clock = f"{hour}:{d:%M} {d:%p}"
    days_ago = (datetime.now().date() - d.date()).days
    if days_ago <= 0:
        day = "Today"
    elif days_ago == 1:
        day = "Yesterday"
    elif days_ago < 7:
        day = f"{d:%A}"
    else:
        day = f"{d:%A} {d:%m-%d-%y}"
    return f"{day} {clock}"


try:
    with open(STATUS) as f:
        st = json.load(f)
except Exception:
    st = {}

now = time.time()
drop = []
last_check = st.get("last_check_at")

if not st:
    title = "| sfimage=music.note.list"
    drop.append("No sync has run yet")
elif not st.get("ok"):
    title = "| sfimage=exclamationmark.triangle.fill"
    drop.append(f"FAILED: {st.get('error', 'unknown error')} | color=red")
elif last_check and now - last_check > STALE_S:
    title = "| sfimage=exclamationmark.triangle.fill"
    drop.append(f"Agent hasn't checked since {fmt_when(last_check)} | color=red")
else:
    title = "| sfimage=music.note.list"

if st.get("today"):
    drop.append(f"Today's Service folder: {st['today']}")
if last_check:
    drop.append(f"Last check: {fmt_when(last_check)}")
new = st.get("last_new") or []
if new and st.get("last_new_at"):
    head = new[0] + (f" (+{len(new) - 1} more)" if len(new) > 1 else "")
    drop.append(f"Newest: {head} - {fmt_when(st['last_new_at'])}")

print(title)
print("---")
print("Service Bundles Sync")
for line in drop:
    print(line)
print("---")
print("Sync Now | bash=/Users/propresenter/Library/Scripts/txt2pro-sync-now.sh "
      "terminal=false refresh=true")
print("Open Today's Service | bash=/Users/propresenter/Library/Scripts/"
      "open-todays-service.sh terminal=false")
print("Open Bundles Folder | bash=/usr/bin/open "
      "param1=/Users/propresenter/Documents/txt2pro terminal=false")
print("View Log | bash=/usr/bin/open param1=-e "
      "param2=/Users/propresenter/Library/Logs/txt2pro-sync.log terminal=false")
