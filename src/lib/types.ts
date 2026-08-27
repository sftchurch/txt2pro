export interface ParsedSong {
  title: string;
  filename: string;
  slides: ParsedSlide[];
  warnings: string[];
}

export interface ParsedSlide {
  label: string;
  originalLines: string[];
  translationLines: string[];
  origPt?: number;
  transPt?: number;
}

export type SlideField = 'original' | 'translation';

// One text element on the slide. `fields` lists which slide fields render into
// it — the main template uses one box per field, the youth template renders
// both fields into a single full-screen box.
export interface TemplateBox {
  name: string;
  fields: SlideField[];
  x: number;
  y: number;
  width: number;
  height: number;
  verticalAlignment: 0 | 1 | 2; // protobuf enum: TOP / MIDDLE / BOTTOM
  style: TextStyle;
  // Preview-parity values: the CSS stack must resolve to the same font file
  // ProPresenter uses, and the line-height is tuned to match its layout.
  cssFontStack: string;
  previewLineHeight: number;
}

export interface SlideTemplateDef {
  id: string;
  label: string;
  width: number;
  height: number;
  boxes: TemplateBox[]; // in .pro element order
  // true = one named, colored cue group per section label (youth);
  // false = a single unnamed group for the whole presentation (main)
  groupBySection: boolean;
}

export interface SlideTemplate {
  width: number;
  height: number;
  original: TextStyle;
  translation: TextStyle;
}

export interface TextStyle {
  fontName: string;
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  color: { r: number; g: number; b: number; a: number };
  alignment: 'left' | 'center' | 'right';
  charset?: number; // RTF \fcharset value; defaults to 0 (ANSI)
}
