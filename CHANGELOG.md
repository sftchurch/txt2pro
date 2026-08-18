# Changelog

Local tracking of notable changes. Newest first.

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
