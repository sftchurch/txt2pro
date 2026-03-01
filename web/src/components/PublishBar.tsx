import { I } from './Icons';
import { T, font } from '../theme';
import type { ClientSong } from '../lib/types';

interface PublishBarProps {
  songs: ClientSong[];
  mobile: boolean;
  onPublish: () => void;
  onPreviewAll: () => void;
}

export function PublishBar({ songs, mobile: mob, onPublish, onPreviewAll }: PublishBarProps) {
  const totalSlides = songs.reduce((a, s) => a + s.count, 0);

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      background: T.bg + "ea", backdropFilter: "blur(16px) saturate(1.4)",
      WebkitBackdropFilter: "blur(16px)",
      borderTop: `1px solid ${T.borderLight}`, padding: mob ? "10px 14px" : "12px 20px",
      paddingBottom: mob ? "calc(10px + env(safe-area-inset-bottom, 0px))" : "12px",
      zIndex: 100, animation: "su .3s cubic-bezier(.16,1,.3,1)",
    }}>
      <div style={{ maxWidth: 700, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: mob ? 11.5 : 12.5, color: T.textSecondary, fontWeight: 500 }}>
          {mob ? `${totalSlides} slides` : `${songs.length} songs · ${totalSlides} slides ready`}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          {!mob && <button onClick={onPreviewAll} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, color: T.textSecondary, cursor: "pointer", fontSize: 12.5, fontWeight: 600, fontFamily: font }}>Preview All</button>}
          <button onClick={onPublish} style={{
            display: "flex", alignItems: "center", gap: 6, padding: mob ? "9px 18px" : "8px 22px",
            borderRadius: 8, border: "none", background: T.primary, color: "#fff", cursor: "pointer",
            fontSize: mob ? 13 : 12.5, fontWeight: 650, fontFamily: font,
            boxShadow: "0 2px 8px rgba(37,99,235,0.25)",
          }}><I.Send /> Publish</button>
        </div>
      </div>
    </div>
  );
}
