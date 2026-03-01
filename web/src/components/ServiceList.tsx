import { useEffect, useState } from 'react';
import { I } from './Icons';
import { T, card, anim, font } from '../theme';
import { fetchServices, createService } from '../lib/api';
import type { Service } from '../lib/types';

interface ServiceListProps {
  mobile: boolean;
  fade: boolean;
  onSelect: (svc: Service) => void;
  onCreate: (svc: Service) => void;
}

function badge(status: string, songCount: number | null) {
  const c = status === "published"
    ? { bg: T.successLight, fg: T.successText, bd: T.successMedium, icon: <I.Check s={11} /> }
    : { bg: T.bgSubtle, fg: T.textMuted, bd: T.border, icon: null };
  const label = status === "published" && songCount
    ? `${songCount} song${songCount !== 1 ? 's' : ''}`
    : "\u2014";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px",
      borderRadius: 99, fontSize: 11, fontWeight: 600, background: c.bg, color: c.fg,
      border: `1px solid ${c.bd}`, whiteSpace: "nowrap", flexShrink: 0,
    }}>{c.icon}{label}</span>
  );
}

function getStatus(svc: Service): string {
  if (svc.current_version > 0) return "published";
  return "empty";
}

function groupByWeek(services: Service[]): { label: string; items: Service[] }[] {
  const now = new Date();
  // Get Monday of this week
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);
  const weekAfter = new Date(nextMonday);
  weekAfter.setDate(nextMonday.getDate() + 7);

  const thisWeek: Service[] = [];
  const nextWeek: Service[] = [];
  const other: Service[] = [];

  for (const s of services) {
    const d = new Date(s.service_date + "T12:00:00");
    if (d >= monday && d < nextMonday) thisWeek.push(s);
    else if (d >= nextMonday && d < weekAfter) nextWeek.push(s);
    else other.push(s);
  }

  // Sort each group by date ascending
  const sortFn = (a: Service, b: Service) => a.service_date.localeCompare(b.service_date);
  thisWeek.sort(sortFn);
  nextWeek.sort(sortFn);
  other.sort(sortFn);

  const groups: { label: string; items: Service[] }[] = [];
  if (thisWeek.length > 0) groups.push({ label: "This Week", items: thisWeek });
  if (nextWeek.length > 0) groups.push({ label: "Next Week", items: nextWeek });
  if (other.length > 0) groups.push({ label: "Other", items: other });

  // If no services in any group, show empty state
  if (groups.length === 0) groups.push({ label: "Services", items: [] });

  return groups;
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
}

// Get next Sunday's date as default for new services
function nextSunday(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 7 : 7 - day; // if today is Sunday, go to next Sunday
  const next = new Date(now);
  next.setDate(now.getDate() + diff);
  return next.toISOString().split('T')[0];
}

export function ServiceList({ mobile: mob, fade: f, onSelect, onCreate }: ServiceListProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState('Sunday Service');
  const [createDate, setCreateDate] = useState(nextSunday);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchServices()
      .then(setServices)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!createTitle.trim() || !createDate) return;
    setCreating(true);
    try {
      const svc = await createService(createTitle.trim(), createDate);
      onCreate({
        id: svc.id,
        service_date: svc.service_date,
        title: svc.title,
        current_version: svc.current_version,
        created_at: new Date().toISOString(),
        checksum: null,
        song_count: null,
        published_at: null,
      });
    } catch (e) {
      console.error(e);
      setCreating(false);
    }
  };

  const groups = groupByWeek(services);

  return (
    <>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: mob ? 22 : 28, paddingBottom: mob ? 16 : 20, borderBottom: `1px solid ${T.borderLight}`, ...anim(f) }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: T.primary, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><I.Music s={16} /></div>
        <div>
          <h1 style={{ fontSize: mob ? 18 : 20, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>txt2pro</h1>
          <p style={{ fontSize: mob ? 12 : 13, color: T.textTertiary, margin: 0 }}>Slide generator for bilingual services</p>
        </div>
      </div>

      {/* Add Service card */}
      {!loading && (
        <div style={{ marginBottom: 22, ...anim(f, 0.03) }}>
          {!showCreate ? (
            <div
              onClick={() => setShowCreate(true)}
              style={{
                display: "flex", alignItems: "center",
                padding: mob ? "10px 12px" : "12px 16px",
                borderRadius: 12, cursor: "pointer",
                border: `2px dashed ${T.border}`,
                background: "transparent",
                transition: "border-color .2s ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = T.primary; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; }}
            >
              <div style={{
                width: mob ? 38 : 42, height: mob ? 38 : 42, borderRadius: 10,
                border: `2px dashed ${T.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                marginRight: mob ? 10 : 14, flexShrink: 0,
                color: T.textMuted,
              }}>
                <I.Plus s={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: mob ? 13 : 14, fontWeight: 580, color: T.textMuted }}>New Service</div>
                <div style={{ fontSize: 11.5, color: T.textTertiary, marginTop: 1 }}>Create a new service</div>
              </div>
            </div>
          ) : (
            <div style={{
              ...card(), padding: mob ? "14px 14px" : "16px 20px",
              border: `1px solid ${T.primaryMedium}`,
            }}>
              <div style={{ display: "flex", flexDirection: mob ? "column" : "row", gap: mob ? 10 : 12, alignItems: mob ? "stretch" : "flex-end" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, display: "block", marginBottom: 4 }}>Title</label>
                  <input
                    type="text"
                    value={createTitle}
                    onChange={e => setCreateTitle(e.target.value)}
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleCreate();
                      if (e.key === 'Escape') setShowCreate(false);
                    }}
                    style={{
                      width: "100%", padding: "7px 10px", borderRadius: 8,
                      border: `1px solid ${T.border}`, background: T.bg,
                      color: T.textPrimary, fontSize: 14, fontFamily: font,
                      outline: "none",
                    }}
                  />
                </div>
                <div style={{ flex: mob ? undefined : 0, minWidth: mob ? undefined : 160 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, display: "block", marginBottom: 4 }}>Date</label>
                  <input
                    type="date"
                    value={createDate}
                    onChange={e => setCreateDate(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleCreate();
                      if (e.key === 'Escape') setShowCreate(false);
                    }}
                    style={{
                      width: "100%", padding: "7px 10px", borderRadius: 8,
                      border: `1px solid ${T.border}`, background: T.bg,
                      color: T.textPrimary, fontSize: 14, fontFamily: font,
                      outline: "none",
                    }}
                  />
                </div>
                <div style={{ display: "flex", gap: 8, alignSelf: mob ? "flex-end" : "flex-end" }}>
                  <button
                    onClick={() => setShowCreate(false)}
                    style={{
                      padding: "7px 14px", borderRadius: 8,
                      border: `1px solid ${T.border}`, background: T.surface,
                      color: T.textMuted, fontSize: 13, fontWeight: 600,
                      cursor: "pointer", fontFamily: font,
                    }}
                  >Cancel</button>
                  <button
                    onClick={handleCreate}
                    disabled={creating || !createTitle.trim() || !createDate}
                    style={{
                      padding: "7px 14px", borderRadius: 8,
                      border: "none", background: T.primary,
                      color: "#fff", fontSize: 13, fontWeight: 600,
                      cursor: creating ? "default" : "pointer", fontFamily: font,
                      opacity: creating ? 0.6 : 1,
                    }}
                  >{creating ? "Creating..." : "Create"}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", padding: 40, color: T.textMuted, fontSize: 13 }}>Loading services...</div>
      )}

      {!loading && services.length === 0 && !showCreate && (
        <div style={{ textAlign: "center", padding: 40, color: T.textMuted, fontSize: 13 }}>No services yet. Click above to create your first service.</div>
      )}

      {!loading && groups.map((g, gi) => (
        <div key={gi} style={{ marginBottom: 22, ...anim(f, 0.05 + gi * 0.05) }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 0 8px 1px" }}>
            <h2 style={{ fontSize: 11, fontWeight: 650, textTransform: "uppercase", letterSpacing: "0.08em", color: T.textMuted, margin: 0 }}>{g.label}</h2>
          </div>
          <div style={card()}>
            {g.items.map((s, i) => {
              const status = getStatus(s);
              const day = dayLabel(s.service_date);
              return (
                <div key={s.id} onClick={() => onSelect(s)} style={{
                  display: "flex", alignItems: "center", padding: mob ? "10px 12px" : "12px 16px", cursor: "pointer",
                  borderBottom: i < g.items.length - 1 ? `1px solid ${T.borderLight}` : "none",
                }}>
                  <div style={{
                    width: mob ? 38 : 42, height: mob ? 38 : 42, borderRadius: 10,
                    background: status === "published" ? T.primaryLight : T.bgSubtle,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    marginRight: mob ? 10 : 14, flexShrink: 0,
                  }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: status === "published" ? T.primaryText : T.textMuted, textTransform: "uppercase", letterSpacing: ".04em", lineHeight: 1 }}>{day}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: status === "published" ? T.primaryText : T.textSecondary, lineHeight: 1.2 }}>{new Date(s.service_date + "T12:00:00").getDate()}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: mob ? 13 : 14, fontWeight: 580, color: T.textPrimary, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 1 }}>{s.service_date}</div>
                  </div>
                  {badge(status, s.song_count)}
                  <span style={{ color: T.textMuted, marginLeft: 6, flexShrink: 0 }}><I.Right s={14} /></span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
