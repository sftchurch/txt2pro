import { forwardRef } from 'react';
import type { ReactNode, CSSProperties } from 'react';

// Every preview lays text out at ProPresenter's canvas size (1920×1080) and is
// scaled down visually with a CSS transform. Laying out at display size instead
// lets browser rounding wrap text differently in each preview.
export const CANVAS_W = 1920;
export const CANVAS_H = 1080;

export const proFont = `'Linux Biolinum', 'Linux Libertine', Georgia, serif`;
export const transColor = "rgb(231, 142, 36)";

// Text element geometry from the exported template (src/lib/template.ts LAYOUT)
const REGION = {
  original: { top: (51.405 / 1080) * 100, height: (401.233 / 1080) * 100 },
  translation: { top: (452.638 / 1080) * 100, height: (627.362 / 1080) * 100 },
} as const;

// Single text style shared by the editor and thumbnails — divergence here makes
// the previews wrap differently
export function slideTextStyle(color: string, fontSize: number): CSSProperties {
  return {
    color, fontSize, fontWeight: 400, textAlign: "center",
    fontFamily: proFont, lineHeight: 1.3, fontKerning: "none",
    whiteSpace: "pre-wrap", wordBreak: "break-word",
  };
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

export const SlideBox = forwardRef<HTMLDivElement, {
  region: keyof typeof REGION;
  border?: string;
  children?: ReactNode;
}>(function SlideBox({ region, border, children }, ref) {
  const r = REGION[region];
  return (
    <div ref={ref} style={{
      position: "absolute", left: 0, right: 0,
      top: `${r.top}%`, height: `${r.height}%`,
      display: "flex", flexDirection: "column", alignItems: "stretch", justifyContent: "flex-start",
      padding: 0, overflow: "hidden",
      border: border ?? "none", borderRadius: 8,
    }}>
      {children}
    </div>
  );
});
