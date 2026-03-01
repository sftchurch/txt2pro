# txt2pro — Final Work Plan (v2)

## Actual File Format (from real church file)

The translation team already produces perfectly structured files. Here's what they actually write:

```
Иисус сегодня, Иисус вчера
Иисус вовеки, Иисус всегда

Jesus today, Jesus yesterday
Jesus forever, Jesus always

Без Него нет счастья, без Него беда
Только с Иисусом жизни полнота!

Without Him - no happiness, without Him - only trouble
Only with Jesus life is complete!
```

**Pattern:** `[1-3 lines original] → blank line → [1-3 lines translation] → blank line → repeat`

The language automatically alternates. No section labels. No separators. They already do this.

### Parser Rules (match their existing workflow)

1. Split file into blocks separated by blank lines
2. Group blocks into pairs: odd blocks = original, even blocks = translation
3. Each pair = one slide
4. Song title = filename (strip extension, clean up underscores)
5. Lines within each block = exact line breaks on the slide

**That's it.** We don't need to force `[Verse 1]` or `---` on them. Their format already works.

### Fallback: If they want to add section labels (optional, not required)

If a block starts with `[Verse 1]` or `[Chorus]`, the parser recognizes it and uses it for the ProPresenter cue label + color coding. If not present, slides are auto-numbered "Slide 1", "Slide 2", etc.

### File types supported

- `.txt` — parse as-is
- `.rtf` — strip all RTF formatting, then parse as text (they currently use RTF from Word)
- Encoding: handle Windows-1251, UTF-8, UTF-8 BOM automatically

---

## Versioning System

Every publish is immutable. Revisions create new versions, not overwrites.

### How it works

```
Volunteer uploads 5 songs → previews → publishes
         = Version 1 (v1)

Worship leader says "change line 3 of song 2"
Translation team fixes the .txt file

Volunteer opens app → drops the revised file(s) → publishes
         = Version 2 (v2)

Church iMac sync agent picks up v2 automatically
ProPresenter operator sees updated slides
```

### R2 Storage Structure

```
/services/{service-id}/
    manifest.json              ← current version pointer + metadata
    v1/
        service.proBundle
        lyrics.json            ← original parsed input
        songs/
            song1.txt          ← raw uploaded files (originals preserved)
            song2.txt
            song3.rtf
        published_at: "2026-03-01T14:30:00Z"
        published_by: "volunteer-name"   (optional, MVP can skip auth)
    v2/
        service.proBundle
        lyrics.json
        songs/
            song2.txt          ← only the changed file (or all files, simpler)
        published_at: "2026-03-01T16:45:00Z"
        changes: "Updated song 2 - fixed chorus line"
    v3/
        ...
```

### manifest.json

```json
{
  "serviceId": "2026-03-02-sunday",
  "serviceDate": "2026-03-02",
  "title": "Sunday Service - March 2, 2026",
  "currentVersion": 3,
  "versions": [
    {
      "version": 1,
      "publishedAt": "2026-02-28T14:30:00Z",
      "songCount": 5,
      "checksum": "abc123",
      "note": ""
    },
    {
      "version": 2,
      "publishedAt": "2026-02-28T16:45:00Z",
      "songCount": 5,
      "checksum": "def456",
      "note": "Fixed chorus in Amazing Grace"
    },
    {
      "version": 3,
      "publishedAt": "2026-03-01T09:00:00Z",
      "songCount": 6,
      "checksum": "ghi789",
      "note": "Added opening song"
    }
  ]
}
```

### Revision UX Flow

When the volunteer opens the app:

**Option A — Fresh service (no existing service for that date)**
```
┌──────────────────────────────────────────┐
│  📅 Service: Sunday, March 2, 2026       │
│                                          │
│  📄 Drop .txt / .rtf files here          │
│     or click to browse                   │
│                                          │
└──────────────────────────────────────────┘
```

**Option B — Updating an existing service**
```
┌──────────────────────────────────────────┐
│  📅 Service: Sunday, March 2, 2026       │
│  ℹ️  Version 2 published 2 hours ago     │
│     (5 songs)                            │
│                                          │
│  [Load Current Version]  or  drop new    │
│     files to create Version 3            │
│                                          │
└──────────────────────────────────────────┘
```

**"Load Current Version"** pulls the existing lyrics and shows them as editable slides. The volunteer can then:
- Drop replacement .txt files (replaces matching songs by filename or lets them pick)
- Add new songs by dropping more files
- Remove songs
- Edit text inline
- Hit "Publish" → creates Version 3

**Or** they can just drop all files fresh (even if some haven't changed) — the system detects what's different and stores it as a new version.

### Version History Panel

Small expandable panel at the bottom or side:

```
📋 Version History
  v3 — Today 9:00 AM — Added opening song
  v2 — Yesterday 4:45 PM — Fixed chorus
  v1 — Yesterday 2:30 PM — Initial publish
  
  [Restore v2]  [Compare v2 ↔ v3]
```

MVP: just list versions with download links.
Post-MVP: visual diff showing what changed between versions.

---

## UI Design System (Locked In)

### Aesthetic Direction
Tailscale-inspired: clean white base, vibrant purposeful accent colors. The background disappears — color earns its place through buttons, badges, and status indicators only.

### Color Palette
```
Base:
  bg:            #f7f7f8    (barely-there gray)
  surface:       #ffffff    (cards, inputs)
  border:        #e5e7eb    (subtle)
  borderLight:   #f3f4f6    (dividers)

Text:
  primary:       #111827    (headings, body)
  secondary:     #4b5563    (descriptions)
  tertiary:      #6b7280    (labels)
  muted:         #9ca3af    (hints, timestamps)

Primary — confident blue:
  primary:       #2563eb
  primaryHover:  #1d4ed8
  primaryLight:  #eff6ff    (subtle bg)
  primaryMedium: #bfdbfe    (borders)

Success — real green:
  success:       #059669
  successLight:  #ecfdf5
  successMedium: #a7f3d0

Warning — warm amber:
  warning:       #d97706
  warningLight:  #fffbeb
  warningMedium: #fde68a

Error:           #dc2626
Custom badge:    #a855f7 (purple, for non-calendar events)
```

### Typography
- **Font:** Inter (Google Fonts) — clean, professional, disappears into the UI
- **Mono:** JetBrains Mono (version badges, slide counters)
- **Scale:** 11px labels → 13.5px body → 17px section heads → 20px page title
- **Weight:** 400 body, 580 medium, 650 semibold, 700 bold

### Components
- **Border radius:** 8px buttons/inputs, 10px date tiles, 12px cards, 14px dropzone, 16px modals
- **Shadows:** minimal — `0 1px 2px rgba(0,0,0,0.04)` for cards, glow ring on focus
- **Animations:** CSS transitions only (no library needed for MVP)
  - Page transitions: fade + translateY(8px), 400ms cubic-bezier(0.16, 1, 0.3, 1)
  - Slide-down for expanding panels
  - Slide-up for publish bar
  - Scale for modal entrance
  - Hover lift on publish button (translateY(-1px) + shadow increase)
- **Backdrop blur:** on publish bar and modals (`blur(16px) saturate(1.4)`)

### UI Stack
- **Vite + React + TypeScript**
- **Tailwind CSS** (utility classes match the palette via tailwind.config)
- **No component library** — custom components matching the approved prototype
- **No Framer Motion** — CSS transitions are sufficient for this UI
- **Reference prototype:** `txt2pro-final-ui.jsx` (approved by Esrael)

### Key UI Features
1. **Service list as hub** — dates auto-populated from church .ics calendar feed
2. **"+ Add Event" button** — for custom events not on the calendar (purple badge)
3. **Multi-week view** — "This Week" / "Next Week" groupings, work ahead freely
4. **Fullscreen slide viewer** — click any slide thumbnail → immersive 16:9 preview
   - Arrow key navigation, dot indicators, Esc to close
   - Dark overlay with blur backdrop
5. **Version history panel** — expandable from header, shows all versions with restore
6. **Publish confirmation modal** — optional revision note, backdrop blur
7. **Success banner** — after publish, shows download button + sync ETA

---

## Updated Decisions

| Decision | Choice |
|----------|--------|
| Input format | Their existing format — no changes required |
| Alternate format | `---` separators and `[Verse 1]` labels supported as optional override |
| Preferred file type | .txt (recommend team switch from .rtf) |
| File types supported | .txt and .rtf (auto-strip RTF formatting) |
| Song title | From filename (clean underscores, strip extension) |
| Section labels | Optional — auto-detect if present, auto-number if not |
| Versioning | Immutable versions, new publish = new version number |
| Sync behavior | Always syncs latest version; sync agent checks checksum |
| Raw file storage | Original uploaded files preserved in R2 per version |
| Revision notes | Optional text field at publish time |
| UI framework | Vite + React + TypeScript + Tailwind CSS |
| UI style | Tailscale-inspired — clean white, vibrant accents |
| Font | Inter + JetBrains Mono |
| Calendar source | Church public .ics feed (auto-populate service dates) |
| Custom events | Supported via "+ Add Event" (purple badge) |
| Slide preview | Fullscreen viewer with arrow key nav |

---

## Updated Project Structure

```
txt2pro/
├── worker/                        # Cloudflare Worker API
│   ├── src/
│   │   ├── index.ts               # API routes
│   │   ├── parser.ts              # .txt/.rtf → structured slide data
│   │   ├── generator.ts           # structured data → .pro protobuf
│   │   ├── rtf-strip.ts           # strip RTF formatting to plain text
│   │   ├── rtf-build.ts           # plain text → RTF bytes for ProPresenter
│   │   ├── bundle.ts              # .pro files → .proBundle ZIP
│   │   ├── template.ts            # slide layout config
│   │   ├── versioning.ts          # version management logic
│   │   └── proto/                 # generated protobuf JS bindings
│   ├── wrangler.toml
│   └── package.json
├── web/                           # React frontend
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── ServicePicker.tsx   # date picker + existing version info
│   │   │   ├── DropZone.tsx        # drag-and-drop file import
│   │   │   ├── SongList.tsx        # imported songs with status
│   │   │   ├── SlidePreview.tsx    # visual slide preview
│   │   │   ├── InlineEditor.tsx    # click slide to edit (optional)
│   │   │   ├── PublishBar.tsx      # verify + publish + revision note
│   │   │   └── VersionHistory.tsx  # version list + restore
│   │   └── lib/
│   │       ├── parser.ts           # client-side parser (instant preview)
│   │       ├── rtf-strip.ts        # client-side RTF stripping
│   │       ├── preview-renderer.ts # canvas slide preview
│   │       └── types.ts
│   └── package.json
├── sync-agent/
│   ├── txt2pro-sync.sh
│   ├── com.txt2pro.sync.plist
│   └── install.sh
└── README.md
```

---

## Updated Parser Spec

```typescript
// parser.ts

interface ParsedSong {
  title: string;           // from filename
  filename: string;        // original filename
  slides: ParsedSlide[];
  warnings: string[];
}

interface ParsedSlide {
  label: string;           // "Slide 1" or "[Verse 1]" if detected
  originalLines: string[]; // 1-3 lines
  translationLines: string[]; // 1-3 lines (can be empty)
}

function parseSongFile(content: string, filename: string): ParsedSong {
  // 1. Detect encoding (UTF-8, Windows-1251, BOM)
  // 2. If RTF: strip all formatting to plain text
  // 3. Normalize line endings (\r\n → \n)
  // 4. Split by blank lines into blocks
  // 5. Detect language pattern:
  //    - If blocks alternate Cyrillic/Latin → pair them as slides
  //    - If blocks don't alternate → treat each block as original-only
  // 6. Check for optional [Section Label] at start of blocks
  // 7. Warn if any line > 50 characters
  // 8. Warn if any block > 3 lines
  // 9. Return structured data
}

// Language detection (simple heuristic):
function isCyrillic(text: string): boolean {
  const cyrillicChars = text.match(/[\u0400-\u04FF]/g) || [];
  const latinChars = text.match(/[a-zA-Z]/g) || [];
  return cyrillicChars.length > latinChars.length;
}

// Pairing logic:
// Given blocks: [A, B, C, D, E, F, G, H]
// If A=cyrillic, B=latin, C=cyrillic, D=latin...
//   → Slides: [A+B], [C+D], [E+F], [G+H]
// If pattern breaks (two cyrillic in a row):
//   → Warn and treat as original-only slide
```

---

## Updated API Routes

```
POST /api/services
  Create or update a service (publishes a new version)
  Body: {
    serviceDate: "2026-03-02",
    title: "Sunday Service",
    songs: [ParsedSong...],
    note: "Fixed chorus line"    // optional revision note
  }
  Files: raw .txt/.rtf files attached (stored in R2)
  Response: {
    serviceId: "2026-03-02-sunday",
    version: 2,
    downloadUrl: "/api/services/2026-03-02-sunday/v2/download"
  }

GET /api/services
  List all services (with latest version info)
  Response: [{ serviceId, date, title, currentVersion, latestChecksum }]

GET /api/services/:id
  Get service manifest (all versions)

GET /api/services/:id/v/:version/download
  Download specific version's .proBundle

GET /api/services/:id/v/:version/lyrics
  Get lyrics JSON for a specific version (for "Load Current Version")

GET /api/services/:id/latest/download
  Download latest version's .proBundle (for sync agent)

GET /api/sync/check
  Return latest service checksum (for sync agent polling)
  Response: {
    serviceId: "2026-03-02-sunday",
    version: 3,
    checksum: "ghi789",
    downloadUrl: "/api/services/2026-03-02-sunday/latest/download"
  }
```

---

## Implementation Phases

### Phase 1: Parser + Generator (Week 1)

**1.1 — Project scaffolding**
- Worker (TypeScript, Cloudflare Worker)
- Web (Vite + React + TypeScript + Tailwind)
- Clone ProPresenter7-Proto, generate JS bindings

**1.2 — RTF stripper**
- Strip Word RTF formatting to plain text
- Handle \'XX hex escapes (Windows-1251 → Unicode)
- Handle \par → newline, \rquote → apostrophe, etc.
- Test with the actual uploaded church file

**1.3 — Text parser**
- Implement the block-pairing algorithm
- Language detection (Cyrillic vs Latin)
- Optional section label detection
- Warning generation
- Test with the actual church file → should produce correct slides

**1.4 — RTF builder (for ProPresenter)**
- Generate RTF bytes for protobuf rtf_data field
- Cyrillic → \uNNNN? Unicode escapes
- Font, size, color, alignment from template

**1.5 — Slide template config**
- Default values (refine from sample .pro file later)
- 1920x1080, black bg, white original, gray translation

**1.6 — Presentation generator**
- ParsedSong → serialized .pro binary via protobuf
- Each slide = Cue with 2 Elements (original + translation)
- CueGroups for songs, Arrangement

**1.7 — Bundle creator**
- Multiple .pro files → .proBundle ZIP (using fflate)
- Combined single-file option (all songs in one .pro)

**1.8 — End-to-end test (GATE CHECK)**
- Parse the actual church RTF file
- Generate .pro
- Verify it opens in ProPresenter with correct text

### Phase 2: Web Frontend (Week 2)

**2.1 — App shell + service picker**
- Date picker (smart default: next Sunday or Friday)
- Show existing version info if service already published

**2.2 — Drop zone + file import**
- Drag-and-drop multiple files
- Instant client-side parsing + preview
- File picker for mobile

**2.3 — Song list + slide preview**
- List of imported songs with status indicators
- Canvas-based slide preview (grid + carousel)
- Conservative sizing (fits here = fits in ProPresenter)

**2.4 — Inline editor**
- Click slide to edit text
- Live preview updates
- Add/remove/reorder slides

**2.5 — Publish flow + revision notes**
- Optional revision note text field
- Confirmation dialog
- Success → download link + "slides will sync automatically"

**2.6 — Version history panel**
- List of versions with timestamps and notes
- "Load Current Version" to pull existing lyrics
- Download link per version

### Phase 3: API + Storage + Versioning (Week 2-3)

**3.1 — Worker API routes**
- All routes from spec above
- R2 integration for storage

**3.2 — Versioning logic**
- Create new version on each publish
- Update manifest.json atomically
- Preserve raw uploaded files per version
- Checksum generation for sync detection

**3.3 — Deploy**
- R2 bucket, Worker, Pages
- Environment variables (AUTH_TOKEN)
- Domain setup (slides.radiomv.live)

### Phase 4: Sync Agent (Week 3)

**4.1 — Sync script**
- Poll /api/sync/check every 5 min
- Compare checksum, download if new
- Extract to ProPresenter library
- macOS notification

**4.2 — launchd + installer**
- One-time setup script
- Auto-start on boot

---

## Critical Prerequisites (unchanged)

Before writing code:

1. ✅ **Sample file format** — NOW UNDERSTOOD from actual church file
2. ⬜ **Export sample .pro file** from church ProPresenter
3. ⬜ **ProPresenter version** on church iMac
4. ⬜ **ProPresenter library path** on church iMac
5. ⬜ **Confirm with translation team** that the parser handles their files correctly
   (give them 2-3 test files to verify)

---

## What Changed from v1

| Area | v1 Plan | v2 Plan |
|------|---------|---------|
| Input format | Proposed new `---` separator format | **Use their existing format as-is** |
| Parser | Look for `---` separator | **Detect language alternation (Cyrillic/Latin pairs)** |
| Section labels | Required | **Optional** (auto-number if absent) |
| RTF handling | Generic strip | **Tested against actual church file** |
| Versioning | None (overwrite) | **Immutable versions with history** |
| Revision UX | None | **Load existing → modify → publish as new version** |
| Raw file storage | Not stored | **Original .txt/.rtf files preserved per version** |
| Revision notes | None | **Optional note field at publish time** |
| Restore | None | **Can restore any previous version** |
