import { useEffect, useState, useMemo } from 'react';
import { I } from './Icons';
import { T, card, anim, font } from '../theme';
import { fetchServices, fetchCalendar, createService, deleteService } from '../lib/api';
import type { Service, CalendarEvent } from '../lib/types';

interface ServiceListProps {
  mobile: boolean;
  fade: boolean;
  onSelect: (svc: Service) => void;
  onCreate: (svc: Service) => void;
}

interface UnifiedItem {
  event: CalendarEvent;
  service?: Service;
}

const SONG_TEMPLATE = `[Verse 1]
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
  const blob = new Blob([SONG_TEMPLATE], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'Song_Title.txt';
  a.click();
  URL.revokeObjectURL(a.href);
}

const EXCLUDED_PREFIXES = ['SFT Youth', 'SFT Young Adults', 'SFT YA'];

const RECURRING_SERVICES = [
  { dayOfWeek: 0, title: 'Sunday Service', time: '11:00 AM' },
  { dayOfWeek: 5, title: 'Friday Service', time: '7:00 PM' },
];

function parseDate(dateStr: string): Date {
  return new Date(dateStr + "T12:00:00");
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

function dayLabel(dateStr: string): string {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][parseDate(dateStr).getDay()];
}

function getWeekBounds() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);
  const weekAfter = new Date(nextMonday);
  weekAfter.setDate(nextMonday.getDate() + 7);
  return { monday, nextMonday, weekAfter };
}

function groupUnifiedItems(items: UnifiedItem[]): { label: string; items: UnifiedItem[] }[] {
  const { monday, nextMonday, weekAfter } = getWeekBounds();

  const thisWeek: UnifiedItem[] = [];
  const nextWeek: UnifiedItem[] = [];

  for (const item of items) {
    const d = parseDate(item.event.date);
    if (d >= monday && d < nextMonday) thisWeek.push(item);
    else if (d >= nextMonday && d < weekAfter) nextWeek.push(item);
  }

  const sortFn = (a: UnifiedItem, b: UnifiedItem) => a.event.date.localeCompare(b.event.date);
  thisWeek.sort(sortFn);
  nextWeek.sort(sortFn);

  const groups: { label: string; items: UnifiedItem[] }[] = [];
  if (thisWeek.length > 0) groups.push({ label: "This Week", items: thisWeek });
  if (nextWeek.length > 0) groups.push({ label: "Next Week", items: nextWeek });

  return groups;
}

function nextSunday(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 7 : 7 - day;
  const next = new Date(now);
  next.setDate(now.getDate() + diff);
  return next.toISOString().split('T')[0];
}

function toService(svc: { id: string; service_date: string; title: string; current_version: number }): Service {
  return {
    id: svc.id,
    service_date: svc.service_date,
    title: svc.title,
    current_version: svc.current_version,
    created_at: new Date().toISOString(),
    checksum: null,
    song_count: null,
    published_at: null,
  };
}

function ServiceCard({ svc, mob, isLast, dimmed, onSelect, onDelete, confirmId, deletingId }: {
  svc: Service;
  mob: boolean;
  isLast: boolean;
  dimmed?: boolean;
  onSelect: (svc: Service) => void;
  onDelete: (svc: Service, e: React.MouseEvent) => void;
  confirmId: string | null;
  deletingId: string | null;
}) {
  const status = getStatus(svc);
  const day = dayLabel(svc.service_date);
  const isConfirm = confirmId === svc.id;
  const isDeleting = deletingId === svc.id;
  return (
    <div onClick={() => onSelect(svc)} style={{
      display: "flex", alignItems: "center", padding: mob ? "10px 12px" : "12px 16px", cursor: "pointer",
      borderBottom: isLast ? "none" : `1px solid ${T.borderLight}`,
      opacity: dimmed ? 0.7 : 1,
    }}>
      <div style={{
        width: mob ? 38 : 42, height: mob ? 38 : 42, borderRadius: 10,
        background: status === "published" ? T.primaryLight : T.bgSubtle,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        marginRight: mob ? 10 : 14, flexShrink: 0,
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: status === "published" ? T.primaryText : T.textMuted, textTransform: "uppercase", letterSpacing: ".04em", lineHeight: 1 }}>{day}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: status === "published" ? T.primaryText : T.textSecondary, lineHeight: 1.2 }}>{parseDate(svc.service_date).getDate()}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: mob ? 13 : 14, fontWeight: 580, color: T.textPrimary, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{svc.title}</span>
        </div>
        <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 1 }}>{svc.service_date}</div>
      </div>
      {badge(status, svc.song_count)}
      <button
        onClick={(e) => onDelete(svc, e)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          marginLeft: 6, flexShrink: 0, border: "none", background: "none",
          cursor: isDeleting ? "default" : "pointer",
          padding: 4, borderRadius: 6,
          color: isConfirm ? T.error : T.textMuted,
          opacity: isDeleting ? 0.4 : 1,
        }}
        title={isConfirm ? "Click again to confirm" : "Delete service"}
      >
        {isConfirm
          ? <span style={{ fontSize: 10, fontWeight: 700, color: T.error }}>Delete?</span>
          : <I.X s={13} />}
      </button>
      <span style={{ color: T.textMuted, marginLeft: 2, flexShrink: 0 }}><I.Right s={14} /></span>
    </div>
  );
}

export function ServiceList({ mobile: mob, fade: f, onSelect, onCreate }: ServiceListProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPast, setShowPast] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState('Sunday Service');
  const [createDate, setCreateDate] = useState(nextSunday);
  const [creating, setCreating] = useState(false);
  const [creatingDate, setCreatingDate] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (svc: Service, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDelete !== svc.id) {
      setConfirmDelete(svc.id);
      return;
    }
    setDeleting(svc.id);
    try {
      await deleteService(svc.id);
      setServices(prev => prev.filter(s => s.id !== svc.id));
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(null);
      setConfirmDelete(null);
    }
  };

  useEffect(() => {
    Promise.all([
      fetchServices().catch(() => [] as Service[]),
      fetchCalendar().catch(() => [] as CalendarEvent[]),
    ]).then(([svcs, events]) => {
      setServices(svcs);
      setCalendarEvents(events);
    }).finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!createTitle.trim() || !createDate) return;
    setCreating(true);
    try {
      const svc = await createService(createTitle.trim(), createDate);
      onCreate(toService(svc));
    } catch (e) {
      console.error(e);
      setCreating(false);
    }
  };

  const handleQuickCreate = async (event: CalendarEvent) => {
    setCreatingDate(event.date);
    try {
      const svc = await createService(event.title, event.date);
      onCreate(toService(svc));
    } catch (e) {
      console.error(e);
      setCreatingDate(null);
    }
  };

  const { groups, pastServices } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const twoWeeksOut = new Date(today);
    twoWeeksOut.setDate(today.getDate() + 14);

    const servicesByDate = new Map<string, Service>();
    for (const svc of services) {
      servicesByDate.set(svc.service_date, svc);
    }

    const filteredCalEvents = calendarEvents.filter(
      e => !EXCLUDED_PREFIXES.some(p => e.title.startsWith(p))
    );
    const calEventsByDate = new Map<string, CalendarEvent[]>();
    for (const event of filteredCalEvents) {
      const existing = calEventsByDate.get(event.date) || [];
      existing.push(event);
      calEventsByDate.set(event.date, existing);
    }

    // Generate recurring slots for the next 2 weeks
    const recurringSlots: CalendarEvent[] = [];
    const cursor = new Date(today);
    while (cursor <= twoWeeksOut) {
      const dow = cursor.getDay();
      const dateStr = cursor.toISOString().split('T')[0];
      const slot = RECURRING_SERVICES.find(r => r.dayOfWeek === dow);
      if (slot) {
        recurringSlots.push({ date: dateStr, title: slot.title, time: slot.time });
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    // Merge: overlay calendar event name if one exists that day
    const upcomingItems: UnifiedItem[] = [];
    const coveredDates = new Set<string>();

    for (const slot of recurringSlots) {
      const calEvents = calEventsByDate.get(slot.date);
      const event = calEvents && calEvents.length > 0
        ? { date: slot.date, title: calEvents[0].title, time: calEvents[0].time }
        : slot;
      upcomingItems.push({ event, service: servicesByDate.get(slot.date) });
      coveredDates.add(slot.date);
    }

    // Calendar events that don't fall on recurring days
    for (const event of filteredCalEvents) {
      if (coveredDates.has(event.date)) continue;
      const d = parseDate(event.date);
      if (d < today || d > twoWeeksOut) continue;
      upcomingItems.push({ event, service: servicesByDate.get(event.date) });
      coveredDates.add(event.date);
    }

    // Services without slots or calendar events
    for (const svc of services) {
      if (coveredDates.has(svc.service_date)) continue;
      const d = parseDate(svc.service_date);
      if (d >= today && d <= twoWeeksOut) {
        upcomingItems.push({
          event: { date: svc.service_date, title: svc.title, time: '' },
          service: svc,
        });
      }
    }

    const past = services
      .filter(s => parseDate(s.service_date) < today)
      .sort((a, b) => b.service_date.localeCompare(a.service_date));

    return { groups: groupUnifiedItems(upcomingItems), pastServices: past };
  }, [services, calendarEvents]);

  return (
    <>
      {/* Header */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        marginBottom: mob ? 22 : 28, paddingBottom: mob ? 16 : 20,
        borderBottom: `1px solid ${T.borderLight}`, ...anim(f),
      }}>
        <h1 style={{ fontSize: mob ? 17 : 19, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>Solid Foundation Texas</h1>
        <p style={{ fontSize: mob ? 11 : 12, color: T.textTertiary, margin: "3px 0 0", letterSpacing: "0.02em" }}>Slide Generator</p>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: 40, color: T.textMuted, fontSize: 13 }}>Loading services...</div>
      )}

      {/* Upcoming grouped cards */}
      {!loading && groups.map((g, gi) => (
        <div key={gi} style={{ marginBottom: 22, ...anim(f, 0.05 + gi * 0.05) }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 0 8px 1px" }}>
            <h2 style={{ fontSize: 11, fontWeight: 650, textTransform: "uppercase", letterSpacing: "0.08em", color: T.textMuted, margin: 0 }}>{g.label}</h2>
          </div>
          <div style={card()}>
            {g.items.map((item, i) => {
              if (item.service) {
                return (
                  <ServiceCard
                    key={item.service.id}
                    svc={item.service}
                    mob={mob}
                    isLast={i === g.items.length - 1}
                    onSelect={onSelect}
                    onDelete={handleDelete}
                    confirmId={confirmDelete}
                    deletingId={deleting}
                  />
                );
              }

              // Suggested calendar event card (no service yet)
              const day = dayLabel(item.event.date);
              const isCreating = creatingDate === item.event.date;
              return (
                <div key={`cal-${item.event.date}-${i}`} style={{
                  display: "flex", alignItems: "center", padding: mob ? "10px 12px" : "12px 16px",
                  borderBottom: i < g.items.length - 1 ? `1px solid ${T.borderLight}` : "none",
                }}>
                  <div style={{
                    width: mob ? 38 : 42, height: mob ? 38 : 42, borderRadius: 10,
                    border: `2px dashed ${T.border}`,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    marginRight: mob ? 10 : 14, flexShrink: 0,
                  }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: ".04em", lineHeight: 1 }}>{day}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: T.textMuted, lineHeight: 1.2 }}>{parseDate(item.event.date).getDate()}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: mob ? 13 : 14, fontWeight: 580, color: T.textSecondary, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.event.title}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 1, display: "flex", alignItems: "center", gap: 4 }}>
                      <I.Calendar s={10} />
                      <span>{item.event.time}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleQuickCreate(item.event)}
                    disabled={isCreating}
                    style={{
                      padding: "5px 12px", borderRadius: 8,
                      border: `1px solid ${T.primaryMedium}`, background: T.primaryLight,
                      color: T.primaryText, fontSize: 12, fontWeight: 600,
                      cursor: isCreating ? "default" : "pointer", fontFamily: font,
                      opacity: isCreating ? 0.6 : 1, flexShrink: 0,
                    }}
                  >{isCreating ? "..." : "Create"}</button>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {!loading && groups.length === 0 && !showCreate && (
        <div style={{ textAlign: "center", padding: 40, color: T.textMuted, fontSize: 13 }}>No upcoming events found.</div>
      )}

      {/* Past services toggle */}
      {!loading && pastServices.length > 0 && (
        <div style={{ marginBottom: 22, ...anim(f, 0.15) }}>
          <button
            onClick={() => setShowPast(!showPast)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 0", border: "none", background: "none",
              color: T.textMuted, fontSize: 12, fontWeight: 600,
              cursor: "pointer", fontFamily: font,
            }}
          >
            <I.History s={12} />
            <span>{showPast ? "Hide" : "Show"} past services ({pastServices.length})</span>
          </button>

          {showPast && (
            <div style={{ ...card(), marginTop: 8 }}>
              {pastServices.map((s, i) => (
                <ServiceCard
                  key={s.id}
                  svc={s}
                  mob={mob}
                  isLast={i === pastServices.length - 1}
                  dimmed
                  onSelect={onSelect}
                  onDelete={handleDelete}
                  confirmId={confirmDelete}
                  deletingId={deleting}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Custom date fallback */}
      {!loading && (
        <div style={{ ...anim(f, 0.2) }}>
          {!showCreate ? (
            <button
              onClick={() => setShowCreate(true)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 0", border: "none", background: "none",
                color: T.textMuted, fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: font,
              }}
            >
              <I.Plus s={12} />
              <span>Custom Date</span>
            </button>
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

      {/* Resources */}
      {!loading && (
        <div style={{ marginTop: 28, ...anim(f, 0.25) }}>
          <h2 style={{ fontSize: 11, fontWeight: 650, textTransform: "uppercase", letterSpacing: "0.08em", color: T.textMuted, margin: "0 0 8px 1px" }}>Resources</h2>
          <div style={{ display: "flex", gap: 10, flexDirection: mob ? "column" : "row" }}>
            <a
              href="/fonts/LinuxBiolinum.zip"
              download
              style={{
                flex: 1, display: "flex", alignItems: "center", gap: 8,
                padding: "10px 14px", borderRadius: 10,
                background: T.bgSubtle, border: `1px solid ${T.borderLight}`,
                textDecoration: "none", cursor: "pointer",
                transition: "background .15s ease",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = T.surfaceHover)}
              onMouseLeave={e => (e.currentTarget.style.background = T.bgSubtle)}
            >
              <span style={{ color: T.primary, flexShrink: 0 }}><I.Type s={15} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: T.textSecondary }}>Linux Biolinum Font</div>
              </div>
              <span style={{ color: T.textMuted, flexShrink: 0 }}><I.Download s={13} /></span>
            </a>
            <button
              onClick={downloadTemplate}
              style={{
                flex: 1, display: "flex", alignItems: "center", gap: 8,
                padding: "10px 14px", borderRadius: 10,
                background: T.bgSubtle, border: `1px solid ${T.borderLight}`,
                cursor: "pointer", fontFamily: font, textAlign: "left",
                transition: "background .15s ease",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = T.surfaceHover)}
              onMouseLeave={e => (e.currentTarget.style.background = T.bgSubtle)}
            >
              <span style={{ color: T.textSecondary, flexShrink: 0 }}><I.File s={15} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: T.textSecondary }}>Song Template (.txt)</div>
              </div>
              <span style={{ color: T.textMuted, flexShrink: 0 }}><I.Download s={13} /></span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
