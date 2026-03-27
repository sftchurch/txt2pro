import type { SlideTemplate } from './types.js';

export const DEFAULT_TEMPLATE: SlideTemplate = {
  width: 1920,
  height: 1080,
  original: {
    fontName: 'LinBiolinum',
    fontFamily: 'Linux Biolinum',
    fontSize: 120,
    bold: false,
    italic: false,
    color: { r: 1, g: 1, b: 1, a: 1 }, // white
    alignment: 'center',
  },
  translation: {
    fontName: 'LinBiolinum',
    fontFamily: 'Linux Biolinum',
    fontSize: 100,
    bold: false,
    italic: false,
    color: { r: 0.9058799743652344, g: 0.5568600296974182, b: 0.14117999374866486, a: 1 }, // orange/gold
    alignment: 'center',
  },
};

// Element positioning constants for a 1920x1080 slide
// Matches the template.pro layout from ProPresenter
export const LAYOUT = {
  // "Main" text element (original/Cyrillic) — upper portion, top-aligned
  original: {
    x: -1.1118169002828873e-13, // ~0
    y: 51.40509825833192,
    width: 1919.9999999999998,
    height: 401.23253045558477,
  },
  // "Translated" text element (English translation) — lower portion, top-aligned
  translation: {
    x: -6.900531164571532e-14, // ~0
    y: 452.63762871391714,
    width: 1919.9999999999998,
    height: 627.3623712860826,
  },
};
