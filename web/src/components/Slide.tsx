import { I } from './Icons';
import type { ClientSlide } from '../lib/types';

const proFont = `'Linux Biolinum', 'Linux Libertine', Georgia, serif`;
const transColor = "rgb(231, 142, 36)";

// Match ProPresenter template.pro layout exactly
// Original ("Main") box: y=-180, height=750 on a 1080px slide
// Translation ("Translated") box: y=270, height=600 on a 1080px slide
// Both vertically centered within their bounding box
const origTop = (-180 / 1080) * 100;     // -16.67%
const origHeight = (750 / 1080) * 100;   // 69.44%
const transTop = (270 / 1080) * 100;     // 25%
const transHeight = (600 / 1080) * 100;  // 55.56%

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
  const origSize = Math.max(5, h * (origPt ? origPt / 1080 : defaultOrigRatio));
  const transSize = Math.max(4.5, h * (transPt ? transPt / 1080 : defaultTransRatio));
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
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: `0 ${pad}px`,
      }}>
        {slide.original.map((l, i) => <div key={i} style={{
          color: "#fff", fontSize: origSize, fontWeight: 700, textAlign: "center",
          fontFamily: proFont, lineHeight: 1.3,
        }}>{l}</div>)}
      </div>
      <div style={{
        position: "absolute", left: 0, right: 0,
        top: `${transTop}%`, height: `${transHeight}%`,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: `0 ${pad}px`,
      }}>
        {slide.translation.map((l, i) => <div key={i} style={{
          color: transColor, fontSize: transSize, fontWeight: 400, textAlign: "center",
          fontFamily: proFont, lineHeight: 1.3,
        }}>{l}</div>)}
      </div>
    </div>
  );
}
