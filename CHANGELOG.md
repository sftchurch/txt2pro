# Changelog

Local tracking of notable changes. Newest first.

## 2026-08-27

### Preparing the repo to go public
- Rewrote `README.md` for a public audience: what the tool does, the lyric
  file format, four ways to use it (CLI, library, self-hosted web app on
  Cloudflare, Mac sync agent), templates, repo layout, API table, limitations,
  credits.
- Moved the Solid Foundation Texas-specific deploy/ops notes (account, URLs,
  verify/rollback, D1 migrations, calendar feed, sync agent) to
  `docs/operations.md`.
- Added an MIT `LICENSE`.
- Set the GitHub repo description and topics (propresenter, church, worship,
  lyrics, cloudflare-workers, …) for discoverability.
- Re-created the GitHub repo with a scrubbed history: the old Planning Center
  ICS feed URL (it embeds a private token) is redacted in every commit. The
  original repo was renamed `txt2pro-archive`, kept private, and archived.
- Added app screenshots to the README (`docs/screenshots/`).
- `.gitignore`: `.DS_Store`, `*.proBundle`, `*.tsbuildinfo`, `.wrangler/`.

## 2026-08-21

### Slide templates (per-service + per-song)
- New shared template registry (`src/lib/templates.ts`) with two templates:
  **Main** (the existing bilingual look — output verified byte-equivalent to
  the pre-refactor generator via a decoded regression fixture) and **Youth**
  (ported from the youth-worship-batch template: one full-screen PT Serif
  100pt white box, middle-aligned, black background, per-section colored cue
  groups with Russian label aliases — Куплет/Припев/…).
- Template is a service property (default `main`, so the normal workflow gains
  zero steps) and each song can override it — the worker already generates one
  .pro per song, so a mixed service just bundles differently-styled songs.
- Worker: `template` accepted on service create + publish (validated), stored
  on `services`, recorded per publish on `versions`, per-song override on
  `songs` and in `lyrics.json`; republish without the field keeps the stored
  template. D1 migration: `worker/migrations/0001-add-template-columns.sql`.
- Slide section labels (`[Verse 1]`…) now survive the full edit round trip
  (import → editor → publish → lyrics → reload) — previously the edited-publish
  path rebuilt them as "Slide N". They drive the youth cue-group colors;
  unlabeled slides join the preceding section's group.
- Web: template picker on the custom-create form (typing "youth" in the title
  pre-selects Youth), template selector in the editor header, per-song override
  picker in the song list, purple template badges on service cards and songs.
  Previews (thumbnails, editor, fullscreen) are template-aware and read the
  same registry the generator uses; PT Serif is self-hosted (latin + cyrillic)
  for measurement parity. Per-slide font sizes now stay unset until touched so
  template defaults apply cleanly.

### Sync agent (first real deployment + fixes)
- Deployed `txt2pro-sync` to the ProPresenter Mac (`propresenter.sft`) for the
  first time — the web app's "syncs to church computer" promise is now true.
  LaunchAgent `com.sftchurch.txt2pro-sync` polls every 60s while logged in and
  at every login; initial mirror of all 48 published bundles verified.
- Fixed `current.proBundle` collision: recurring titles ("Friday Service")
  share a folder, and on a fresh sync (empty state) an older service processed
  later could overwrite the stable pointer with last week's bundle. Only the
  newest service per title (by `service_date`, then `published_at`) may write
  `current.proBundle` now.
- Downloads now stage in the agent's state dir instead of a `.part` file
  inside the destination folder — `~/Documents` on the church Mac is
  iCloud-synced, and temp-then-rename inside a synced folder can leave Finder
  showing stale contents (and ProPresenter/iCloud should never see a partial
  bundle).
- The agent writes an atomic `status.json` (last check, result, newest
  downloads) consumed by a new SwiftBar menu bar plugin
  (`sync/txt2prosync.30s.py`): music-note icon, last-check/newest-bundle info,
  Sync Now (opens new bundles in ProPresenter), Open Bundles Folder, View Log.
- New "Today's Service" folder (`~/Desktop/Today's Service`, override with
  `TXT2PRO_TODAY`): always exactly one bundle — the service dated today, else
  the next upcoming, else the most recent past. On a Friday the Friday bundle
  stays current even if Sunday's was published later; the every-60s run flips
  it automatically at midnight. Shown in the menu bar dropdown with an
  "Open Today's Service" action.

## 2026-08-17

### Calendar
- Switched the service calendar feed from Planning Center to Timely Church
  (`ICAL_URL` in `worker/wrangler.jsonc`).
- Fixed timezone handling for the new feed: Timely publishes UTC timestamps
  (`...Z`) with no TZID, so the worker now converts them to America/Chicago
  before formatting. Previously a Friday 7 PM service displayed as Saturday
  12:00 AM. All-day and non-UTC entries parse as before.

### Editor rendering fidelity (WYSIWYG vs ProPresenter)
- Self-hosted Linux Biolinum (`web/public/fonts/LinBiolinum_R.woff2` +
  `@font-face` in `index.html`) so slide previews measure the same font
  ProPresenter renders, regardless of what's installed on the viewer's machine.
  Previously the editor silently fell back to Georgia when the font wasn't
  installed locally.
- Removed the `× 0.9` font-size fudge factor and the 3.1%-per-side padding in
  the fullscreen editor. Together they let the editor fit ~4% more text per
  line than ProPresenter, causing "fits in editor, wraps in ProPresenter".
- Disabled kerning in previews (`font-kerning: none`) to match the exported
  attributed string (`kerning: 0`).
- Removed the vertical font-size clamp. The exported text element uses
  `scale_behavior: NONE`, so ProPresenter clips oversize text rather than
  shrinking it — the preview now does the same. Above ~99 pt with 3 lines the
  editor previously stopped scaling text visually.
- Added a red bottom-edge indicator on a text box when its content overruns
  vertically (i.e. it will be cut off in ProPresenter).
- Unified editor and thumbnail rendering on a shared 1920×1080 canvas
  (`web/src/components/SlideCanvas.tsx`), scaled down with a CSS transform.
  Text layout is computed once at export resolution, so the fullscreen editor,
  the thumbnails, and the exported slide all wrap identically. Thumbnails
  dropped their extra `× 0.75` small-size shrink and minimum font floors.

### Known limitations
- Vertical fit vs ProPresenter is approximate: previews use `line-height: 1.3`
  while the export writes `line_height_multiple: 1` (CoreText natural leading).
  The overflow indicator is calibrated to 1.3 and can misjudge borderline cases.
- Downloads always serve the last *published* version. Edits autosave as a
  local browser draft only — publish before downloading to include them.
  (Candidate improvement: badge download buttons when unpublished edits exist.)
