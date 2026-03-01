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
}
