import type { SlideTemplate } from './types.js';

export const DEFAULT_TEMPLATE: SlideTemplate = {
  width: 1920,
  height: 1080,
  original: {
    fontName: 'LinBiolinumB',
    fontFamily: 'Linux Biolinum',
    fontSize: 120,
    bold: true,
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
  // "Main" text element (original/Cyrillic) — extends above slide
  original: {
    x: 0,
    y: -180,
    width: 1919.9999999999998,
    height: 750,
  },
  // "Translated" text element (English translation) — lower portion
  translation: {
    x: 2.2737367544323206e-13, // ~0
    y: 270,
    width: 1919.9999999999998,
    height: 600,
  },
};
