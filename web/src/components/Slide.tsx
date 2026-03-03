import { I } from './Icons';
import type { ClientSlide } from '../lib/types';

const proFont = `'Linux Biolinum', 'Linux Libertine', Georgia, serif`;
const transColor = "rgb(231, 142, 36)";

// Match ProPresenter new-template.pro layout exactly
// Original ("Main") box: y=51.405, height=401.233 on a 1080px slide
// Translation ("Translated") box: y=452.638, height=627.362 on a 1080px slide
// Both top-aligned within their bounding box
const origTop = (51.405 / 1080) * 100;     // 4.76%
const origHeight = (401.233 / 1080) * 100; // 37.15%
const transTop = (452.638 / 1080) * 100;   // 41.91%
const transHeight = (627.362 / 1080) * 100; // 58.09%

// Default font size as fraction of slide height (pt / slide height)
const defaultOrigRatio = 120 / 1080;
const defaultTransRatio = 100 / 1080;

interface SlideProps {
  slide: ClientSlide;
  small?: boolean;
  mobile?: boolean;
  onClick?: () => void;
  origPt?: number;
  transPt?: number;
}

export function Slide({ slide, small, mobile, onClick, origPt, transPt }: SlideProps) {
  const w = mobile ? 152 : small ? 184 : 320;
  const h = mobile ? 85 : small ? 103 : 180;
  const scale = small ? 0.75 : 1;
  const origBoxH = h * origHeight / 100;
  const transBoxH = h * transHeight / 100;
  const origLines = Math.max(slide.original.length, 1);
  const transLines = Math.max(slide.translation.length, 1);
  const origSize = Math.min(
    Math.max(5, h * (origPt ? origPt / 1080 : defaultOrigRatio) * scale),
    origBoxH / (origLines * 1.35),
  );
  const transSize = Math.min(
    Math.max(4.5, h * (transPt ? transPt / 1080 : defaultTransRatio) * scale),
    transBoxH / (transLines * 1.35),
  );
  const pad = mobile ? 4 : small ? 6 : 10;

  return (
    <div onClick={onClick} style={{
      width: w, height: h, background: "#000", borderRadius: mobile ? 8 : 10,
      position: "relative", overflow: "hidden",
      boxShadow: "0 4px 20px rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)",
      flexShrink: 0, cursor: onClick ? "pointer" : "default",
      WebkitTapHighlightColor: "transparent",
    }}>
      {onClick && <div style={{ position: "absolute", top: 4, right: 6, color: "rgba(255,255,255,0.15)", zIndex: 2 }}><I.Expand s={10} /></div>}
      <div style={{
        position: "absolute", left: 0, right: 0,
        top: `${origTop}%`, height: `${origHeight}%`,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start",
        padding: `0 ${pad}px`, overflow: "hidden",
      }}>
        {slide.original.map((l, i) => <div key={i} style={{
          color: "#fff", fontSize: origSize, fontWeight: 700, textAlign: "center",
          fontFamily: proFont, lineHeight: 1.3,
        }}>{l}</div>)}
      </div>
      <div style={{
        position: "absolute", left: 0, right: 0,
        top: `${transTop}%`, height: `${transHeight}%`,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start",
        padding: `0 ${pad}px`, overflow: "hidden",
      }}>
        {slide.translation.map((l, i) => <div key={i} style={{
          color: transColor, fontSize: transSize, fontWeight: 400, textAlign: "center",
          fontFamily: proFont, lineHeight: 1.3,
        }}>{l}</div>)}
      </div>
    </div>
  );
}
