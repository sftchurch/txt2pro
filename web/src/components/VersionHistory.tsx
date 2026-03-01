import { useEffect, useState } from 'react';
import { T, fontMono, font, card } from '../theme';
import { fetchService, downloadUrl } from '../lib/api';
import { I } from './Icons';
import type { VersionInfo } from '../lib/types';

interface VersionHistoryProps {
  serviceId: string;
  mobile: boolean;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return isToday ? `Today ${time}` : `${d.toLocaleDateString()} ${time}`;
}

export function VersionHistory({ serviceId, mobile: mob }: VersionHistoryProps) {
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchService(serviceId)
      .then(data => setVersions(data.versions))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [serviceId]);

  if (loading) {
    return <div style={{ ...card(), padding: mob ? 12 : 16, marginBottom: 18, textAlign: "center", color: T.textMuted, fontSize: 12 }}>Loading history...</div>;
  }

  if (versions.length === 0) {
    return <div style={{ ...card(), padding: mob ? 12 : 16, marginBottom: 18, textAlign: "center", color: T.textMuted, fontSize: 12 }}>No versions yet</div>;
  }

  return (
    <div style={{ ...card(), padding: mob ? 12 : 16, marginBottom: 18, animation: "sd .2s cubic-bezier(.16,1,.3,1)" }}>
      <h3 style={{ fontSize: 12, fontWeight: 650, color: T.textTertiary, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: ".06em" }}>Version History</h3>
      {versions.map((ver, i) => (
        <div key={ver.id} style={{
          display: "flex", alignItems: "center", padding: mob ? "8px 8px" : "9px 10px", borderRadius: 8,
          marginBottom: i < versions.length - 1 ? 4 : 0,
          background: i === 0 ? T.primaryLight : "transparent",
          border: `1px solid ${i === 0 ? T.primaryMedium : "transparent"}`, gap: 8,
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7,
            background: i === 0 ? T.primary : T.bgSubtle,
            color: i === 0 ? "#fff" : T.textMuted,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 700, fontFamily: fontMono, flexShrink: 0,
          }}>v{ver.version}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 550, color: T.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {ver.note || `Version ${ver.version}`}
            </div>
            <div style={{ fontSize: 10.5, color: T.textMuted, marginTop: 1 }}>
              {formatDate(ver.published_at)} · {ver.song_count} songs
            </div>
          </div>
          {i > 0 && (
            <a href={downloadUrl(ver.service_id, ver.version)} style={{
              padding: "4px 10px", borderRadius: 7, border: `1px solid ${T.border}`, background: T.surface,
              fontSize: 11, fontWeight: 600, color: T.textTertiary, cursor: "pointer", fontFamily: font,
              flexShrink: 0, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4,
            }}><I.Download s={11} /> Download</a>
          )}
        </div>
      ))}
    </div>
  );
}
