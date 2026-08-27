import { useRef, useState } from 'react';
import { I } from './Icons';
import { T, font, fontMono, anim } from '../theme';
import { parseSongFile } from '@shared/parser';
import type { ClientSong } from '../lib/types';

interface DropZoneProps {
  songs: ClientSong[];
  onSongsChange: (songs: ClientSong[]) => void;
  mobile: boolean;
  fade: boolean;
}

const TEMPLATE = `[Verse 1]
Main language line 1
Main language line 2

Translation line 1
Translation line 2

[Chorus]
Main chorus line 1
Main chorus line 2

Translation chorus line 1
Translation chorus line 2

[Verse 2]
Main verse 2 line 1
Main verse 2 line 2

Translation verse 2 line 1
Translation verse 2 line 2

[Bridge]
Main bridge line 1
Main bridge line 2

Translation bridge line 1
Translation bridge line 2

[Outro]
Main outro line 1

Translation outro line 1
`;

function downloadTemplate() {
  const blob = new Blob([TEMPLATE], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'Song_Title.txt';
  a.click();
  URL.revokeObjectURL(a.href);
}

async function processFiles(files: FileList | File[]): Promise<ClientSong[]> {
  const result: ClientSong[] = [];
  for (const file of Array.from(files)) {
    if (!file.name.match(/\.(txt|rtf)$/i)) continue;
    const text = await file.text();
    const parsed = parseSongFile(text, file.name);
    result.push({
      title: parsed.title,
      filename: parsed.filename,
      file,
      ok: parsed.warnings.length === 0,
      warn: parsed.warnings.length > 0 ? parsed.warnings[0] : null,
      count: parsed.slides.length,
      slides: parsed.slides.map(s => ({
        original: s.originalLines,
        translation: s.translationLines,
        label: s.label,
      })),
    });
  }
  return result;
}

export function DropZone({ songs, onSongsChange, mobile: mob, fade: f }: DropZoneProps) {
  const [drag, setDrag] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | File[]) => {
    const newSongs = await processFiles(files);
    if (newSongs.length > 0) {
      onSongsChange([...songs, ...newSongs]);
    }
  };

  return (
    <>
      <input ref={inputRef} type="file" accept=".txt,.rtf" multiple hidden
        onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }} />
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); }}
        style={{
          background: drag ? T.primaryLight : T.surface,
          border: `2px dashed ${drag ? T.primary : T.border}`,
          borderRadius: 14, padding: songs.length > 0 ? (mob ? "10px 12px" : "13px 16px") : (mob ? "36px 16px" : "48px 24px"),
          textAlign: "center", cursor: "pointer",
          transition: "all .2s ease", boxShadow: drag ? T.glow : "none",
          marginBottom: 18, ...anim(f, 0.05),
        }}
      >
        {songs.length === 0 ? (
          <div>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: T.primaryLight, color: T.primary, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}><I.Upload s={20} /></div>
            <div style={{ fontSize: mob ? 14 : 15, fontWeight: 650, color: T.textPrimary, marginBottom: 4 }}>Drop .txt or .rtf files here</div>
            <div style={{ fontSize: 12.5, color: T.textMuted, marginBottom: 14 }}>One file per song · bilingual lyrics auto-detected</div>
            <button style={{ padding: "8px 18px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, color: T.textSecondary, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font }}>{mob ? "Tap to browse files" : "or click to browse"}</button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: T.textMuted }}><I.Upload s={16} /></span>
            <span style={{ fontSize: 12, color: T.textMuted }}>{mob ? "Tap to add more files" : "Drop more files to add or replace songs"}</span>
          </div>
        )}
      </div>

      {/* Format guide + template download */}
      {songs.length === 0 && (
        <div style={{ textAlign: "center", marginTop: -10, marginBottom: 18, ...anim(f, 0.1) }}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowGuide(!showGuide); }}
            style={{
              background: "none", border: "none", cursor: "pointer", padding: "4px 8px",
              fontSize: 12, color: T.primary, fontFamily: font, fontWeight: 500,
            }}
          >
            {showGuide ? "Hide format guide" : "How should I format my files?"}
          </button>

          {showGuide && (
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12,
                padding: mob ? "16px 14px" : "20px 24px", textAlign: "left",
                marginTop: 8, boxShadow: T.sm, animation: "sd .2s ease",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 650, color: T.textPrimary, marginBottom: 10 }}>Recommended format</div>

              <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.6, marginBottom: 12 }}>
                <div style={{ marginBottom: 6 }}><strong style={{ color: T.textPrimary }}>Filename</strong> becomes the song title — use underscores for spaces (e.g. <code style={{ fontFamily: fontMono, fontSize: 11, background: T.bgSubtle, padding: "1px 5px", borderRadius: 4 }}>Great_Is_Thy_Faithfulness.txt</code>)</div>
                <div style={{ marginBottom: 6 }}><strong style={{ color: T.textPrimary }}>Separate blocks</strong> with a blank line between each one</div>
                <div style={{ marginBottom: 6 }}><strong style={{ color: T.textPrimary }}>Main first, then translation</strong> — 1st block = main (any language), blank line, 2nd block = translation</div>
                <div style={{ marginBottom: 6 }}><strong style={{ color: T.textPrimary }}>Labels</strong> are optional — e.g. <code style={{ fontFamily: fontMono, fontSize: 11, background: T.bgSubtle, padding: "1px 5px", borderRadius: 4 }}>[Verse 1]</code> <code style={{ fontFamily: fontMono, fontSize: 11, background: T.bgSubtle, padding: "1px 5px", borderRadius: 4 }}>[Chorus]</code> <code style={{ fontFamily: fontMono, fontSize: 11, background: T.bgSubtle, padding: "1px 5px", borderRadius: 4 }}>[Bridge]</code> <code style={{ fontFamily: fontMono, fontSize: 11, background: T.bgSubtle, padding: "1px 5px", borderRadius: 4 }}>[Outro]</code></div>
                <div><strong style={{ color: T.textPrimary }}>Max 3 lines</strong> per block for best readability</div>
              </div>

              <div style={{
                background: T.bgSubtle, borderRadius: 8, padding: mob ? "10px 12px" : "12px 16px",
                fontFamily: fontMono, fontSize: 11, lineHeight: 1.7,
                color: T.textSecondary, whiteSpace: "pre", overflowX: "auto",
                border: `1px solid ${T.borderLight}`, marginBottom: 14,
              }}>
                <span style={{ color: T.primary }}>[Verse 1]</span>{'\n'}
                <span style={{ color: T.textPrimary }}>Main line 1 (any language)</span>{'\n'}
                <span style={{ color: T.textPrimary }}>Main line 2</span>{'\n'}
                {'\n'}
                <span style={{ color: "rgb(231, 142, 36)" }}>Translation line 1</span>{'\n'}
                <span style={{ color: "rgb(231, 142, 36)" }}>Translation line 2</span>{'\n'}
                {'\n'}
                <span style={{ color: T.primary }}>[Chorus]</span>{'\n'}
                <span style={{ color: T.textPrimary }}>Main chorus line</span>{'\n'}
                {'\n'}
                <span style={{ color: "rgb(231, 142, 36)" }}>Translation chorus line</span>
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); downloadTemplate(); }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "7px 14px", borderRadius: 8,
                  border: `1px solid ${T.border}`, background: T.surface,
                  color: T.primary, fontSize: 12, fontWeight: 600,
                  cursor: "pointer", fontFamily: font,
                }}
              >
                <I.Download s={13} /> Download template (.txt)
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
