import { useState } from 'react';
import { I } from './Icons';
import { T, font } from '../theme';
import { publishService } from '../lib/api';
import type { Service, ClientSong, PublishResult } from '../lib/types';

interface PublishModalProps {
  service: Service;
  songs: ClientSong[];
  mobile: boolean;
  onClose: () => void;
  onPublished: (result: PublishResult) => void;
}

export function PublishModal({ service, songs, mobile: mob, onClose, onPublished }: PublishModalProps) {
  const [note, setNote] = useState('');
  const [publishing, setPublishing] = useState(false);

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const result = await publishService(
        service.title,
        service.service_date,
        songs.map(s => ({
          title: s.title,
          filename: s.filename,
          file: s.file,
          slides: s.slides,
        })),
        note,
      );
      onPublished(result);
    } catch (err) {
      console.error('Publish failed:', err);
      setPublishing(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(17,24,39,0.3)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: mob ? "flex-end" : "center", justifyContent: "center",
      zIndex: 200, animation: "fi .12s ease", padding: mob ? 0 : 20,
    }}>
      <div style={{
        background: T.surface, borderRadius: mob ? "20px 20px 0 0" : 16,
        boxShadow: T.lg, padding: mob ? "24px 18px 28px" : "28px",
        maxWidth: 420, width: "100%",
        animation: mob ? "su .25s cubic-bezier(.16,1,.3,1)" : "si .2s cubic-bezier(.16,1,.3,1)",
        paddingBottom: mob ? "calc(28px + env(safe-area-inset-bottom, 0px))" : "28px",
      }}>
        {mob && <div style={{ width: 36, height: 4, borderRadius: 2, background: T.border, margin: "0 auto 16px" }} />}
        <h3 style={{ fontSize: mob ? 18 : 17, fontWeight: 700, margin: "0 0 6px" }}>Publish slides?</h3>
        <p style={{ fontSize: 13.5, color: T.textSecondary, margin: "0 0 20px", lineHeight: 1.55 }}>
          {songs.length} songs for <strong>{service.title}</strong> on {service.service_date}. The church computer will sync automatically.
        </p>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: T.textSecondary, display: "block", marginBottom: 5 }}>
            Revision note <span style={{ color: T.textMuted, fontWeight: 400 }}>(optional)</span>
          </label>
          <input type="text" placeholder="e.g. Fixed chorus in song 2" value={note} onChange={e => setNote(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !publishing) handlePublish(); }}
            style={{
              width: "100%", padding: mob ? "11px 12px" : "9px 12px", borderRadius: 8,
              border: `1px solid ${T.border}`, background: T.bg, fontSize: mob ? 16 : 13,
              fontFamily: font, color: T.textPrimary, outline: "none", boxSizing: "border-box",
            }}
            onFocus={e => { e.target.style.borderColor = T.borderFocus; e.target.style.boxShadow = T.glow; }}
            onBlur={e => { e.target.style.borderColor = T.border; e.target.style.boxShadow = "none"; }}
          />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: mob ? "stretch" : "flex-end", flexDirection: mob ? "column-reverse" : "row" }}>
          <button onClick={onClose} disabled={publishing} style={{
            padding: mob ? "11px 18px" : "8px 18px", borderRadius: 8, border: `1px solid ${T.border}`,
            background: T.surface, color: T.textSecondary, cursor: "pointer", fontSize: 13, fontWeight: 600,
            fontFamily: font, flex: mob ? 1 : "none", opacity: publishing ? 0.5 : 1,
          }}>Cancel</button>
          <button onClick={handlePublish} disabled={publishing} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: mob ? "11px 20px" : "8px 20px", borderRadius: 8, border: "none",
            background: T.primary, color: "#fff", cursor: publishing ? "default" : "pointer",
            fontSize: 13, fontWeight: 650, fontFamily: font,
            boxShadow: "0 2px 8px rgba(37,99,235,0.25)", flex: mob ? 1 : "none",
            opacity: publishing ? 0.7 : 1,
          }}><I.Send /> {publishing ? "Publishing..." : "Publish Now"}</button>
        </div>
      </div>
    </div>
  );
}
