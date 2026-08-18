import { I } from './Icons';
import type { ClientSlide } from '../lib/types';
import { CanvasLayer, SlideBox, slideTextStyle, transColor } from './SlideCanvas';

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

  return (
    <div onClick={onClick} style={{
      width: w, aspectRatio: "16/9", background: "#000", borderRadius: mobile ? 8 : 10,
      position: "relative", overflow: "hidden",
      boxShadow: "0 4px 20px rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)",
      flexShrink: 0, cursor: onClick ? "pointer" : "default",
      WebkitTapHighlightColor: "transparent",
    }}>
      {onClick && <div style={{ position: "absolute", top: 4, right: 6, color: "rgba(255,255,255,0.15)", zIndex: 2 }}><I.Expand s={10} /></div>}
      <CanvasLayer width={w}>
        <SlideBox region="original">
          <div style={slideTextStyle("#fff", origPt ?? 120)}>{slide.original.join('\n')}</div>
        </SlideBox>
        <SlideBox region="translation">
          <div style={slideTextStyle(transColor, transPt ?? 100)}>{slide.translation.join('\n')}</div>
        </SlideBox>
      </CanvasLayer>
    </div>
  );
}
