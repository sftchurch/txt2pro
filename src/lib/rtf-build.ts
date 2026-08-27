import type { TextStyle } from './types.js';

function cssrgbComponent(value: number): string {
  // ProPresenter cssrgb uses values in range 0-100000
  return String(Math.round(value * 100000));
}

export function buildRtf(text: string, style: TextStyle): Uint8Array {
  const fontSize = style.fontSize * 2; // RTF uses half-points
  const r = Math.round(style.color.r * 255);
  const g = Math.round(style.color.g * 255);
  const b = Math.round(style.color.b * 255);

  const cssR = cssrgbComponent(style.color.r);
  const cssG = cssrgbComponent(style.color.g);
  const cssB = cssrgbComponent(style.color.b);

  let rtf = `{\\rtf1\\ansi\\ansicpg1252\\cocoartf2868\n`;
  rtf += `\\cocoatextscaling0\\cocoaplatform0`;
  rtf += `{\\fonttbl\\f0\\fnil\\fcharset${style.charset ?? 0} ${style.fontName};}\n`;
  rtf += `{\\colortbl;\\red255\\green255\\blue255;\\red${r}\\green${g}\\blue${b};}\n`;
  rtf += `{\\*\\expandedcolortbl;;\\cssrgb\\c${cssR}\\c${cssG}\\c${cssB};}\n`;
  rtf += `\\pard\\pardirnatural\\qc\\partightenfactor0\n\n`;
  rtf += `\\f0`;
  if (style.bold) rtf += '\\b';
  rtf += `\\fs${fontSize} \\cf2 \\up0 `;

  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) rtf += '\\\n';
    // \uc0 is emitted once at start of each line (before first unicode char)
    let uc0Emitted = false;
    for (const ch of lines[i]) {
      const cp = ch.codePointAt(0)!;

      // ASCII printable
      if (cp >= 0x20 && cp <= 0x7E) {
        if (ch === '\\' || ch === '{' || ch === '}') {
          rtf += '\\' + ch;
        } else {
          rtf += ch;
        }
        continue;
      }

      // Unicode escape for non-ASCII
      if (cp > 0x7F) {
        if (!uc0Emitted) {
          rtf += `\\uc0\\u${cp} `;
          uc0Emitted = true;
        } else {
          rtf += `\\u${cp} `;
        }
        continue;
      }
    }
  }

  rtf += '}';
  return new TextEncoder().encode(rtf);
}
