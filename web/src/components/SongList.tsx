import { useState, useRef, useEffect, useCallback, Fragment } from 'react';
import { I } from './Icons';
import { Slide } from './Slide';
import { T, font, fontMono, card, anim } from '../theme';
import { songProUrl } from '../lib/api';
import type { ClientSong } from '../lib/types';

const SECTION_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444'];

function sectionColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return SECTION_COLORS[Math.abs(h) % SECTION_COLORS.length];
}

interface SongGroup {
  section: string | undefined;
  items: { song: ClientSong; index: number }[];
}

function groupSongs(songs: ClientSong[]): SongGroup[] {
  const groups: SongGroup[] = [];
  for (let i = 0; i < songs.length; i++) {
    const sec = songs[i].section || undefined;
    const last = groups[groups.length - 1];
    if (last && last.section === sec) {
      last.items.push({ song: songs[i], index: i });
    } else {
      groups.push({ section: sec, items: [{ song: songs[i], index: i }] });
    }
  }
  return groups;
}

interface SongListProps {
  songs: ClientSong[];
  expandedSong: number | null;
  mobile: boolean;
  fade: boolean;
  serviceId: string | null;
  version: number;
  onExpand: (index: number | null) => void;
  onRemove: (index: number) => void;
  onMove?: (from: number, to: number) => void;
  onFullscreen: (songIndex: number, slideIndex: number) => void;
  onSlideInsert?: (songIndex: number, afterSlideIndex: number) => void;
  onSlideDelete?: (songIndex: number, slideIndex: number) => void;
  onSectionChange?: (songIndex: number, section: string) => void;
}

function SlideWithActions({ song, songIndex, slideIndex, mobile, onFullscreen, onSlideDelete }: {
  song: ClientSong;
  songIndex: number;
  slideIndex: number;
  mobile: boolean;
  onFullscreen: (songIndex: number, slideIndex: number) => void;
  onSlideDelete?: (songIndex: number, slideIndex: number) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const canDelete = onSlideDelete && song.slides.length > 1;

  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ position: "absolute", top: 4, left: 6, fontSize: 7.5, fontWeight: 700, fontFamily: fontMono, color: "rgba(255,255,255,0.3)", zIndex: 1 }}>{slideIndex + 1}</div>
      {canDelete && (hovered || mobile) && (
        <button
          onClick={(e) => { e.stopPropagation(); onSlideDelete(songIndex, slideIndex); }}
          style={{
            position: "absolute", top: 3, right: 3, zIndex: 2,
            width: mobile ? 20 : 18, height: mobile ? 20 : 18, borderRadius: "50%",
            background: "rgba(255,60,60,0.85)", border: "none",
            color: "#fff", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 0, animation: "fi .1s ease",
          }}
        ><I.X s={mobile ? 10 : 9} /></button>
      )}
      <Slide
        slide={song.slides[slideIndex]}
        small
        mobile={mobile}
        onClick={() => onFullscreen(songIndex, slideIndex)}
        origPt={song.slides[slideIndex].origPt}
        transPt={song.slides[slideIndex].transPt}
      />
    </div>
  );
}

const dropLine: React.CSSProperties = {
  height: 3, background: T.primary, borderRadius: 2,
  margin: "0 14px", transition: "opacity .15s ease",
  boxShadow: `0 0 6px ${T.primary}40`,
};

export function SongList({ songs, expandedSong: exp, mobile: mob, fade: f, serviceId, version, onExpand, onRemove, onMove, onFullscreen, onSlideInsert, onSlideDelete, onSectionChange }: SongListProps) {
  const [editingSection, setEditingSection] = useState<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [touchDragging, setTouchDragging] = useState(false);
  const [floatPos, setFloatPos] = useState({ x: 0, y: 0 });
  const dragImageRef = useRef<HTMLDivElement | null>(null);
  const rowRectsRef = useRef<Map<number, DOMRect>>(new Map());
  const rowRefsMap = useRef<Map<number, HTMLDivElement>>(new Map());
  const canDownload = serviceId && version > 0;
  const groups = groupSongs(songs);

  // Measure all song row positions for touch hit-testing
  const measureRows = useCallback(() => {
    const rects = new Map<number, DOMRect>();
    rowRefsMap.current.forEach((el, idx) => {
      rects.set(idx, el.getBoundingClientRect());
    });
    rowRectsRef.current = rects;
  }, []);

  // Touch drag: determine overIdx from Y position
  const getOverIdxFromY = useCallback((clientY: number): number | null => {
    const rects = rowRectsRef.current;
    let result: number | null = null;
    for (const [idx, rect] of rects) {
      const midY = rect.top + rect.height / 2;
      if (clientY < midY) {
        result = idx;
        break;
      }
      result = idx + 1;
    }
    if (result !== null && dragIdx !== null) {
      if (result === dragIdx || result === dragIdx + 1) return null;
    }
    return result;
  }, [dragIdx]);

  // Touch handlers
  const handleTouchStart = useCallback((idx: number, e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    measureRows();
    setDragIdx(idx);
    setTouchDragging(true);
    const touch = e.touches[0];
    setFloatPos({ x: touch.clientX, y: touch.clientY });
  }, [measureRows]);

  useEffect(() => {
    if (!touchDragging) return;

    const handleMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      setFloatPos({ x: touch.clientX, y: touch.clientY });
      setOverIdx(getOverIdxFromY(touch.clientY));
    };

    const handleEnd = () => {
      if (dragIdx !== null && overIdx !== null && onMove) {
        const to = overIdx > dragIdx ? overIdx - 1 : overIdx;
        if (to !== dragIdx) onMove(dragIdx, to);
      }
      setDragIdx(null);
      setOverIdx(null);
      setTouchDragging(false);
    };

    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
    window.addEventListener('touchcancel', handleEnd);
    return () => {
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
      window.removeEventListener('touchcancel', handleEnd);
    };
  }, [touchDragging, dragIdx, overIdx, onMove, getOverIdxFromY]);

  // Desktop drag handlers
  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    if (dragImageRef.current) {
      dragImageRef.current.textContent = songs[idx].title;
      dragImageRef.current.style.display = 'block';
      e.dataTransfer.setDragImage(dragImageRef.current, 0, 16);
      requestAnimationFrame(() => { if (dragImageRef.current) dragImageRef.current.style.display = 'none'; });
    }
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    if (dragIdx === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const target = e.clientY < midY ? idx : idx + 1;
    if (target !== dragIdx && target !== dragIdx + 1) {
      setOverIdx(target);
    } else {
      setOverIdx(null);
    }
  };

  const handleDrop = () => {
    if (dragIdx !== null && overIdx !== null && onMove) {
      const to = overIdx > dragIdx ? overIdx - 1 : overIdx;
      if (to !== dragIdx) onMove(dragIdx, to);
    }
    setDragIdx(null);
    setOverIdx(null);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setOverIdx(null);
  };

  const renderDropIndicator = (position: number) => {
    if (dragIdx === null || overIdx !== position) return null;
    return <div style={dropLine} />;
  };

  const setRowRef = useCallback((idx: number, el: HTMLDivElement | null) => {
    if (el) rowRefsMap.current.set(idx, el);
    else rowRefsMap.current.delete(idx);
  }, []);

  const renderSongRow = (song: ClientSong, i: number, isLast: boolean) => (
    <div
      key={i}
      ref={el => setRowRef(i, el)}
      onDragOver={e => handleDragOver(e, i)}
      onDrop={handleDrop}
      style={{
        opacity: dragIdx === i ? 0.4 : 1,
        transition: "opacity .2s ease",
      }}
    >
      {renderDropIndicator(i)}
      <div onClick={() => onExpand(exp === i ? null : i)} style={{
        display: "flex", alignItems: "center", padding: mob ? "10px 10px" : "11px 14px", cursor: "pointer",
        borderBottom: (!isLast || exp === i) ? `1px solid ${T.borderLight}` : "none",
        background: exp === i ? T.surfaceActive : "transparent",
      }}>
        {/* Drag handle */}
        {onMove && songs.length > 1 && (
          <div
            draggable={!mob}
            onDragStart={!mob ? (e => { e.stopPropagation(); handleDragStart(e, i); }) : undefined}
            onDragEnd={!mob ? handleDragEnd : undefined}
            onTouchStart={mob ? (e => handleTouchStart(i, e)) : undefined}
            onClick={e => e.stopPropagation()}
            style={{
              cursor: mob ? "grab" : "grab", marginRight: mob ? 4 : 6,
              color: T.textMuted, opacity: mob ? 0.5 : 0.4,
              display: "flex", alignItems: "center",
              padding: mob ? "8px 2px" : "4px 0",
              touchAction: "none",
              transition: "opacity .15s",
            }}
            onMouseEnter={!mob ? (e => { e.currentTarget.style.opacity = '0.8'; }) : undefined}
            onMouseLeave={!mob ? (e => { e.currentTarget.style.opacity = '0.4'; }) : undefined}
          >
            <I.Grip s={mob ? 16 : 14} />
          </div>
        )}
        <div style={{
          width: 22, height: 22, borderRadius: "50%",
          background: song.ok ? T.successLight : T.warningLight,
          color: song.ok ? T.success : T.warning,
          display: "flex", alignItems: "center", justifyContent: "center",
          marginRight: mob ? 8 : 11, flexShrink: 0,
          border: `1px solid ${song.ok ? T.successMedium : T.warningMedium}`,
        }}>
          {song.ok ? <I.Check s={12} /> : <I.Warn s={12} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: mob ? 13 : 13.5, fontWeight: 580, color: T.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{song.title}</div>
          <div style={{ fontSize: mob ? 10.5 : 11, color: song.warn ? T.warningText : T.textMuted, marginTop: 1, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            {song.count} slides
            {song.warn && <><span style={{ color: T.warning }}>·</span><span style={{ color: T.warningText }}>{song.warn}</span></>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
          {canDownload && (
            <a href={songProUrl(serviceId, version, i)} onClick={e => e.stopPropagation()} style={{
              width: 28, height: 28, borderRadius: 7, border: "none", background: "transparent",
              color: T.textMuted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              padding: 0, textDecoration: "none",
            }} title={`Download ${song.title}.pro`}><I.Download s={13} /></a>
          )}
          <button onClick={e => { e.stopPropagation(); onRemove(i); }} style={{
            width: 28, height: 28, borderRadius: 7, border: "none", background: "transparent",
            color: T.textMuted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            padding: 0, flexShrink: 0,
          }}><I.X /></button>
        </div>
      </div>

      {exp === i && (
        <div style={{ padding: mob ? "10px 10px" : "14px 14px", background: T.bgSubtle, borderBottom: !isLast ? `1px solid ${T.borderLight}` : "none", animation: "sd .15s cubic-bezier(.16,1,.3,1)" }}>
          <div style={{ display: "flex", gap: mob ? 8 : 10, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch", alignItems: "center" }}>
            {song.slides.map((_, si) => (
              <SlideWithActions
                key={si}
                song={song}
                songIndex={i}
                slideIndex={si}
                mobile={mob}
                onFullscreen={onFullscreen}
                onSlideDelete={onSlideDelete}
              />
            ))}
            {onSlideInsert && (
              <button
                onClick={() => onSlideInsert(i, song.slides.length - 1)}
                style={{
                  width: mob ? 152 : 184, height: mob ? 85 : 103, borderRadius: mob ? 8 : 10,
                  background: "transparent",
                  border: `2px dashed ${T.border}`,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  gap: 4, color: T.textMuted, cursor: "pointer", flexShrink: 0,
                  transition: "border-color .2s ease",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = T.primary; e.currentTarget.style.color = T.primary; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMuted; }}
              >
                <I.Plus s={16} />
                <span style={{ fontSize: 10, fontWeight: 600 }}>Add slide</span>
              </button>
            )}
            {song.count > song.slides.length && (
              <div style={{
                width: mob ? 152 : 184, height: mob ? 85 : 103, borderRadius: mob ? 8 : 10,
                background: T.surface, border: `1px solid ${T.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: T.textMuted, fontSize: 12, fontWeight: 550, flexShrink: 0,
              }}>+{song.count - song.slides.length} more</div>
            )}
          </div>
        </div>
      )}
      {isLast && renderDropIndicator(i + 1)}
    </div>
  );

  return (
    <div style={anim(f, 0.1)}>
      {/* Hidden custom drag image (desktop) */}
      <div ref={dragImageRef} style={{
        display: 'none', position: 'fixed', top: -100, left: -100,
        background: T.primary, color: '#fff', padding: '4px 12px',
        borderRadius: 6, fontSize: 12, fontWeight: 600, fontFamily: font,
        whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 9999,
      }} />

      {/* Floating label for touch drag */}
      {touchDragging && dragIdx !== null && (
        <div style={{
          position: 'fixed',
          left: floatPos.x + 10,
          top: floatPos.y - 20,
          background: T.primary, color: '#fff',
          padding: '5px 14px', borderRadius: 8,
          fontSize: 13, fontWeight: 600, fontFamily: font,
          whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 9999,
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          transform: 'translateX(-50%)',
        }}>
          {songs[dragIdx]?.title}
        </div>
      )}

      <div style={{ margin: "0 1px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 650, textTransform: "uppercase", letterSpacing: ".08em", color: T.textMuted }}>
          {songs.length} Songs · {songs.reduce((a, s) => a + s.count, 0)} Slides
        </span>
        {canDownload && (
          <span style={{ fontSize: 10, fontWeight: 600, color: T.textMuted }}>
            Revision {version}
          </span>
        )}
      </div>
      {groups.map((group, gi) => {
        const displayName = group.section || 'Songs';
        const color = sectionColor(displayName);
        const isDefault = !group.section;

        return (
          <Fragment key={gi}>
            <div style={{
              ...card(),
              borderLeft: `3px solid ${color}`,
              marginBottom: 8,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center',
                padding: mob ? '6px 10px' : '7px 14px',
                borderBottom: `1px solid ${T.borderLight}`,
                gap: 8,
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: color,
                  flexShrink: 0,
                }} />
                {editingSection === gi && onSectionChange ? (
                  <input
                    autoFocus
                    defaultValue={displayName}
                    onBlur={e => {
                      const v = e.target.value.trim();
                      if (v && v !== displayName) {
                        group.items.forEach(item => onSectionChange(item.index, v));
                      }
                      setEditingSection(null);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      if (e.key === 'Escape') setEditingSection(null);
                    }}
                    style={{
                      flex: 1, background: 'transparent', border: 'none', outline: 'none',
                      color: T.textSecondary, fontSize: 11, fontWeight: 650,
                      textTransform: 'uppercase', letterSpacing: '.06em',
                      fontFamily: font, padding: 0,
                    }}
                  />
                ) : (
                  <span
                    onClick={onSectionChange ? () => setEditingSection(gi) : undefined}
                    style={{
                      flex: 1, fontSize: 11, fontWeight: 650,
                      textTransform: 'uppercase', letterSpacing: '.06em',
                      color: T.textSecondary,
                      cursor: onSectionChange ? 'pointer' : 'default',
                    }}
                  >
                    {displayName}
                  </span>
                )}
                {!isDefault && onSectionChange && (
                  <button
                    onClick={() => group.items.forEach(item => onSectionChange(item.index, ''))}
                    style={{
                      width: 20, height: 20, borderRadius: 5,
                      border: 'none', background: 'transparent',
                      color: T.textMuted, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: 0, flexShrink: 0,
                    }}
                  ><I.X s={10} /></button>
                )}
              </div>
              {group.items.map(({ song, index }, j) =>
                renderSongRow(song, index, j === group.items.length - 1)
              )}
            </div>
            {onSectionChange && group.items.length > 1 && (
              <button
                onClick={() => {
                  const lastItem = group.items[group.items.length - 1];
                  onSectionChange(lastItem.index, 'Untitled');
                }}
                style={{
                  width: '100%', height: 30, borderRadius: 8,
                  background: 'transparent', border: `1.5px dashed ${T.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 6, color: T.textMuted, cursor: 'pointer',
                  fontSize: 11, fontWeight: 600, fontFamily: font,
                  marginBottom: 8, transition: 'border-color .2s, color .2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = T.primary; e.currentTarget.style.color = T.primary; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMuted; }}
              >
                <I.Plus s={11} /> Add Section
              </button>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
