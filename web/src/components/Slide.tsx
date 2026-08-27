import { I } from './Icons';
import type { ClientSlide } from '../lib/types';
import { CanvasLayer, SlideBox, slideTextStyle, resolveTemplate, boxColor, boxFontSize, boxText } from './SlideCanvas';

interface SlideProps {
  slide: ClientSlide;
  small?: boolean;
  mobile?: boolean;
  onClick?: () => void;
  origPt?: number;
  transPt?: number;
  template?: string;
}

export function Slide({ slide, small, mobile, onClick, origPt, transPt, template }: SlideProps) {
  const w = mobile ? 152 : small ? 184 : 320;
  const def = resolveTemplate(template);
  const sizes = { origPt, transPt };

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
        {def.boxes.map(box => (
          <SlideBox key={box.name} box={box}>
            <div style={slideTextStyle(boxColor(box), boxFontSize(box, sizes), box.cssFontStack, box.previewLineHeight)}>
              {boxText(box, slide)}
            </div>
          </SlideBox>
        ))}
      </CanvasLayer>
    </div>
  );
}
