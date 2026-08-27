import { forwardRef } from 'react';
import type { ReactNode, CSSProperties } from 'react';
import { resolveTemplate, cssColor } from '@shared/templates';
import type { TemplateBox, SlideField } from '@shared/types';
import type { ClientSlide } from '../lib/types';

// Every preview lays text out at ProPresenter's canvas size (1920×1080) and is
// scaled down visually with a CSS transform. Laying out at display size instead
// lets browser rounding wrap text differently in each preview.
export const CANVAS_W = 1920;
export const CANVAS_H = 1080;

export { resolveTemplate };
export const transColor = "rgb(231, 142, 36)";

// Single text style shared by the editor and thumbnails — divergence here makes
// the previews wrap differently
export function slideTextStyle(
  color: string,
  fontSize: number,
  fontFamily: string,
  lineHeight: number,
): CSSProperties {
  return {
    color, fontSize, fontWeight: 400, textAlign: "center",
    fontFamily, lineHeight, fontKerning: "none",
    whiteSpace: "pre-wrap", wordBreak: "break-word",
  };
}

// Box-derived helpers so thumbnails and the editor resolve text/color/size the
// same way the generator does
export function boxColor(box: TemplateBox): string {
  return cssColor(box.style.color);
}

export function boxFontSize(box: TemplateBox, slide: { origPt?: number; transPt?: number }): number {
  // A merged box (youth) follows the original size, matching the generator
  const override = box.fields.includes('original') ? slide.origPt : slide.transPt;
  return override ?? box.style.fontSize;
}

export function boxText(box: TemplateBox, slide: ClientSlide): string {
  return box.fields
    .map((f: SlideField) => (f === 'original' ? slide.original : slide.translation))
    .filter(lines => lines.length > 0)
    .map(lines => lines.join('\n'))
    .join('\n');
}

// The scaled 1920×1080 layer; the parent supplies a sized 16:9 container
// (position: relative, overflow: hidden)
export function CanvasLayer({ width, children }: { width: number; children: ReactNode }) {
  return (
    <div style={{
      position: "absolute", top: 0, left: 0,
      width: CANVAS_W, height: CANVAS_H,
      transform: `scale(${width / CANVAS_W})`, transformOrigin: "top left",
    }}>
      {children}
    </div>
  );
}

const VALIGN_JUSTIFY = ['flex-start', 'center', 'flex-end'] as const;

export const SlideBox = forwardRef<HTMLDivElement, {
  box: TemplateBox;
  border?: string;
  children?: ReactNode;
}>(function SlideBox({ box, border, children }, ref) {
  return (
    <div ref={ref} style={{
      position: "absolute",
      left: `${(box.x / CANVAS_W) * 100}%`,
      width: `${(box.width / CANVAS_W) * 100}%`,
      top: `${(box.y / CANVAS_H) * 100}%`,
      height: `${(box.height / CANVAS_H) * 100}%`,
      display: "flex", flexDirection: "column", alignItems: "stretch",
      justifyContent: VALIGN_JUSTIFY[box.verticalAlignment] ?? "flex-start",
      padding: 0, overflow: "hidden",
      border: border ?? "none", borderRadius: 8,
    }}>
      {children}
    </div>
  );
});
