import { I } from './Icons';
import { T, font, anim } from '../theme';
import { downloadUrl } from '../lib/api';
import { TEMPLATES } from '@shared/templates';
import type { Service } from '../lib/types';

interface EditorHeaderProps {
  service: Service;
  mobile: boolean;
  fade: boolean;
  hasSongs: boolean;
  saveStatus?: 'saving' | 'saved' | null;
  showHistory: boolean;
  template: string;
  onTemplateChange?: (template: string) => void;
  onBack: () => void;
  onToggleHistory: () => void;
}

export function EditorHeader({ service, mobile: mob, fade: f, hasSongs, saveStatus, showHistory, template, onTemplateChange, onBack, onToggleHistory }: EditorHeaderProps) {
  const ver = service.current_version;
  const published = ver > 0;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: mob ? 18 : 24, paddingBottom: mob ? 14 : 18, borderBottom: `1px solid ${T.borderLight}`, ...anim(f) }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
        <button onClick={onBack} style={{
          width: 34, height: 34, borderRadius: 10, border: `1px solid ${T.border}`, background: T.surface,
          cursor: "pointer", color: T.textTertiary, display: "flex", alignItems: "center", justifyContent: "center",
          padding: 0, flexShrink: 0,
        }}><I.Left /></button>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <h1 style={{ fontSize: mob ? 15 : 17, fontWeight: 700, margin: 0, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{service.title}</h1>
            {published && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                background: T.primaryLight, color: T.primaryText, whiteSpace: "nowrap",
              }}>v{ver}</span>
            )}
          </div>
          <p style={{ fontSize: 12, color: T.textMuted, margin: "1px 0 0", display: "flex", alignItems: "center", gap: 6 }}>
            <span>{service.service_date}</span>
            {saveStatus && (
              <span style={{ display: "flex", alignItems: "center", gap: 3, color: saveStatus === 'saved' ? T.success : T.textMuted }}>
                <span aria-hidden style={{ opacity: 0.5 }}>·</span>
                {saveStatus === 'saved' ? <I.Check s={11} /> : null}
                {saveStatus === 'saved' ? 'Saved' : 'Saving…'}
              </span>
            )}
          </p>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        {onTemplateChange && (
          <div style={{ position: "relative", display: "flex", alignItems: "center" }} title="Slide template">
            <span style={{
              position: "absolute", left: mob ? 8 : 10, display: "flex", pointerEvents: "none",
              color: template !== 'main' ? T.accentText : T.textTertiary,
            }}><I.Layout s={13} /></span>
            <select
              value={template}
              onChange={e => onTemplateChange(e.target.value)}
              style={{
                appearance: "none", WebkitAppearance: "none",
                padding: mob ? "5px 22px 5px 26px" : "6px 26px 6px 30px", borderRadius: 8,
                border: `1px solid ${template !== 'main' ? T.accentMedium : T.border}`,
                background: template !== 'main' ? T.accentLight : T.surface,
                color: template !== 'main' ? T.accentText : T.textTertiary,
                // 16px on mobile — smaller focused form controls make iOS Safari zoom the page
                cursor: "pointer", fontSize: mob ? 16 : 12, fontWeight: 600, fontFamily: font,
              }}
            >
              {Object.values(TEMPLATES).map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
            <span style={{
              position: "absolute", right: mob ? 6 : 8, display: "flex", pointerEvents: "none",
              color: template !== 'main' ? T.accentText : T.textMuted,
            }}><I.Down s={11} /></span>
          </div>
        )}
        {published && (
          <a href={downloadUrl(service.id, ver)} style={{
            display: "flex", alignItems: "center", gap: 4, padding: mob ? "5px 10px" : "6px 14px", borderRadius: 8,
            border: `1px solid ${T.border}`, background: T.surface, color: T.textTertiary,
            cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: font, textDecoration: "none",
          }}><I.Download s={13} />{!mob && " Bundle"}</a>
        )}
        {hasSongs && (
          <button onClick={onToggleHistory} style={{
            display: "flex", alignItems: "center", gap: 4, padding: mob ? "5px 10px" : "6px 14px", borderRadius: 8,
            border: `1px solid ${showHistory ? T.primaryMedium : T.border}`,
            background: showHistory ? T.primaryLight : T.surface,
            color: showHistory ? T.primaryText : T.textTertiary,
            cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: font, flexShrink: 0,
          }}><I.History />{!mob && " History"}</button>
        )}
      </div>
    </div>
  );
}
