import { I } from './Icons';
import { Slide } from './Slide';
import { T, fontMono, card, anim } from '../theme';
import { songProUrl } from '../lib/api';
import type { ClientSong } from '../lib/types';

interface SongListProps {
  songs: ClientSong[];
  expandedSong: number | null;
  mobile: boolean;
  fade: boolean;
  serviceId: string | null;
  version: number;
  songFonts?: Record<number, { origPt: number; transPt: number }>;
  onExpand: (index: number | null) => void;
  onRemove: (index: number) => void;
  onFullscreen: (songIndex: number, slideIndex: number) => void;
}

export function SongList({ songs, expandedSong: exp, mobile: mob, fade: f, serviceId, version, songFonts, onExpand, onRemove, onFullscreen }: SongListProps) {
  const canDownload = serviceId && version > 0;

  return (
    <div style={anim(f, 0.1)}>
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
      <div style={card()}>
        {songs.map((song, i) => (
          <div key={i}>
            <div onClick={() => onExpand(exp === i ? null : i)} style={{
              display: "flex", alignItems: "center", padding: mob ? "10px 10px" : "11px 14px", cursor: "pointer",
              borderBottom: (i < songs.length - 1 || exp === i) ? `1px solid ${T.borderLight}` : "none",
              background: exp === i ? T.surfaceActive : "transparent",
            }}>
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
                  {!mob && <I.File />}
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: mob ? 120 : "none" }}>{song.filename}</span>
                  <span style={{ color: T.textMuted }}>·</span> {song.count} slides
                  {song.warn && <><span style={{ color: T.warning }}>·</span><span style={{ color: T.warningText }}>{song.warn}</span></>}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
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
              <div style={{ padding: mob ? "10px 10px" : "14px 14px", background: T.bgSubtle, borderBottom: i < songs.length - 1 ? `1px solid ${T.borderLight}` : "none", animation: "sd .15s cubic-bezier(.16,1,.3,1)" }}>
                <div style={{ display: "flex", gap: mob ? 8 : 10, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch" }}>
                  {song.slides.map((sl, si) => (
                    <div key={si} style={{ position: "relative" }}>
                      <div style={{ position: "absolute", top: 4, left: 6, fontSize: 7.5, fontWeight: 700, fontFamily: fontMono, color: "rgba(255,255,255,0.3)", zIndex: 1 }}>{si + 1}</div>
                      <Slide slide={sl} small mobile={mob} onClick={() => onFullscreen(i, si)} origPt={songFonts?.[i]?.origPt} transPt={songFonts?.[i]?.transPt} />
                    </div>
                  ))}
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
          </div>
        ))}
      </div>
    </div>
  );
}
