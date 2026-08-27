import type { SlideTemplateDef } from './types.js';
import { DEFAULT_TEMPLATE, LAYOUT } from './template.js';

// Named slide templates, shared by the worker (generation) and the web app
// (previews, via the @shared alias). `main` reuses the exact values the
// generator has always used; `youth` is ported from the decoded
// youth-worship-batch/template.pro (single full-screen PT Serif box,
// middle-aligned, per-section colored cue groups).

export type TemplateId = 'main' | 'youth';

export const DEFAULT_TEMPLATE_ID: TemplateId = 'main';

const BIOLINUM_STACK = `'Linux Biolinum', 'Linux Libertine', Georgia, serif`;

export const TEMPLATES: Record<TemplateId, SlideTemplateDef> = {
  main: {
    id: 'main',
    label: 'Main',
    width: DEFAULT_TEMPLATE.width,
    height: DEFAULT_TEMPLATE.height,
    boxes: [
      // Element order matches the exported template: Translated first, then Main
      {
        name: 'Translated',
        fields: ['translation'],
        ...LAYOUT.translation,
        verticalAlignment: 0,
        style: DEFAULT_TEMPLATE.translation,
        cssFontStack: BIOLINUM_STACK,
        previewLineHeight: 1.3,
      },
      {
        name: 'Main',
        fields: ['original'],
        ...LAYOUT.original,
        verticalAlignment: 0,
        style: DEFAULT_TEMPLATE.original,
        cssFontStack: BIOLINUM_STACK,
        previewLineHeight: 1.3,
      },
    ],
    groupBySection: false,
  },
  youth: {
    id: 'youth',
    label: 'Youth',
    width: 1920,
    height: 1080,
    boxes: [
      {
        name: 'Main',
        fields: ['original', 'translation'],
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
        verticalAlignment: 1, // MIDDLE
        style: {
          fontName: 'PTSerif-Regular',
          fontFamily: 'PT Serif',
          fontSize: 100,
          bold: false,
          italic: false,
          color: { r: 1, g: 1, b: 1, a: 1 },
          alignment: 'center',
          charset: 204,
        },
        cssFontStack: `'PT Serif', Georgia, serif`,
        previewLineHeight: 1.3,
      },
    ],
    groupBySection: true,
  },
};

export function isTemplateId(value: unknown): value is TemplateId {
  // Own-property check — `in` would also accept Object.prototype keys like
  // 'toString', letting an invalid id through validation and into the DB
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(TEMPLATES, value);
}

// Unknown/legacy ids fall back to main so old data keeps rendering
export function resolveTemplate(id: string | null | undefined): SlideTemplateDef {
  return isTemplateId(id) ? TEMPLATES[id] : TEMPLATES.main;
}

export function cssColor(c: { r: number; g: number; b: number }): string {
  return `rgb(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)})`;
}

// ---- Section cue-group colors (youth) ------------------------------------
// Ported from youth-worship-batch/src/generate.mjs. Verse + Chorus mirror the
// colors of the exported youth template's own groups.

export interface GroupColor {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

const SECTION_COLORS: Record<string, GroupColor> = {
  Verse:      { red: 0.37254902720451355, green: 0.6196078658103943, blue: 0.6274510025978088, alpha: 1 },
  Chorus:     { red: 0.800000011920929,   green: 0,                  blue: 0.30588236451148987, alpha: 1 },
  Bridge:     { red: 0.55,                green: 0.35,               blue: 0.7,                 alpha: 1 },
  BridgeTag:  { red: 0.30,                green: 0.70,               blue: 0.30,                alpha: 1 },
  PreChorus:  { red: 0.95,                green: 0.6,                blue: 0.15,                alpha: 1 },
  Intro:      { red: 0.55,                green: 0.55,               blue: 0.55,                alpha: 1 },
  Outro:      { red: 0.55,                green: 0.55,               blue: 0.55,                alpha: 1 },
  Ending:     { red: 0.55,                green: 0.55,               blue: 0.55,                alpha: 1 },
  Tag:        { red: 0.30,                green: 0.70,               blue: 0.30,                alpha: 1 },
  Default:    { red: 0.5,                 green: 0.5,                blue: 0.5,                 alpha: 1 },
};

// Russian section-name aliases → same colors as their English counterparts
SECTION_COLORS['Куплет']     = SECTION_COLORS.Verse;
SECTION_COLORS['Припев']     = SECTION_COLORS.Chorus;
SECTION_COLORS['Предприпев'] = SECTION_COLORS.PreChorus;
SECTION_COLORS['Бридж']      = SECTION_COLORS.Bridge;
SECTION_COLORS['Вступление'] = SECTION_COLORS.Intro;
SECTION_COLORS['Концовка']   = SECTION_COLORS.Outro;

export function sectionColor(label: string): GroupColor {
  const key = label.replace(/\s+\d+\s*$/, '').replace(/-/g, '').replace(/\s+/g, '');
  return SECTION_COLORS[key] || SECTION_COLORS.Default;
}

// Parser-assigned fallback labels ("Slide 3") are not real section labels
export function isSectionLabel(label: string | undefined): label is string {
  return !!label && !/^Slide \d+$/.test(label);
}
