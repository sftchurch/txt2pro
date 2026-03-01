import { useRef, useState } from 'react';
import { I } from './Icons';
import { T, font, anim } from '../theme';
import { parseSongFile } from '@shared/parser';
import type { ClientSong } from '../lib/types';

interface DropZoneProps {
  songs: ClientSong[];
  onSongsChange: (songs: ClientSong[]) => void;
  mobile: boolean;
  fade: boolean;
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
      })),
    });
  }
  return result;
}

export function DropZone({ songs, onSongsChange, mobile: mob, fade: f }: DropZoneProps) {
  const [drag, setDrag] = useState(false);
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
    </>
  );
}
