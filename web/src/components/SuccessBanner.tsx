import { I } from './Icons';
import { T } from '../theme';
import type { PublishResult } from '../lib/types';

interface SuccessBannerProps {
  result: PublishResult;
  mobile: boolean;
}

export function SuccessBanner({ result, mobile: mob }: SuccessBannerProps) {
  const url = `${import.meta.env.VITE_API_URL}${result.downloadUrl}`;
  return (
    <div style={{
      background: T.successLight, border: `1px solid ${T.successMedium}`, borderRadius: 12,
      padding: mob ? "14px 12px" : "18px 20px", marginBottom: 18,
      display: "flex", alignItems: mob ? "flex-start" : "center", gap: mob ? 10 : 14,
      flexDirection: mob ? "column" : "row", animation: "sd .3s cubic-bezier(.16,1,.3,1)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: T.success, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><I.Check s={14} /></div>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 650, color: T.successText }}>Published as Version {result.version}</div>
          <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 1 }}>Syncs to church computer in ~5 min</div>
        </div>
      </div>
      <a href={url} download style={{
        display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 8,
        border: `1px solid ${T.successMedium}`, background: T.surface, color: T.successText,
        cursor: "pointer", fontSize: 12, fontWeight: 600, textDecoration: "none",
        alignSelf: mob ? "flex-end" : "center", flexShrink: 0,
      }}><I.Download /> Download</a>
    </div>
  );
}
