import { stripRtf } from './rtf-strip.js';
import type { ParsedSong, ParsedSlide } from './types.js';

function extractLabel(block: string): { label: string | null; text: string } {
  const lines = block.split('\n');
  const match = lines[0].match(/^\[(.+)\]$/);
  if (match) {
    return {
      label: match[1],
      text: lines.slice(1).join('\n').trim(),
    };
  }
  return { label: null, text: block };
}

function titleFromFilename(filename: string): string {
  return filename
    .replace(/\.(txt|rtf)$/i, '')
    .replace(/_/g, ' ')
    .replace(/(^|\s)\S/g, ch => ch.toUpperCase());
}

export function parseSongFile(content: string, filename: string): ParsedSong {
  // Strip RTF if needed
  if (content.trimStart().startsWith('{\\rtf')) {
    content = stripRtf(content);
  }

  // Normalize line endings
  content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split into blocks by blank lines (including lines with only whitespace/non-breaking spaces)
  const rawBlocks = content.split(/\n(?:[^\S\n]*\n)+/).filter(b => b.trim().length > 0);

  const warnings: string[] = [];
  const slides: ParsedSlide[] = [];

  // Process blocks: extract labels
  const blocks: Array<{ label: string | null; lines: string[] }> = [];
  for (const raw of rawBlocks) {
    const { label, text } = extractLabel(raw.trim());
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    if (lines.length === 0) continue;
    blocks.push({ label, lines });
  }

  // Pair blocks positionally: 1st = original, 2nd = translation, etc.
  let slideNum = 1;
  let i = 0;
  while (i < blocks.length) {
    const orig = blocks[i];
    const trans = blocks[i + 1];

    if (orig.lines.length > 3) {
      warnings.push(`Slide ${slideNum}: original block has ${orig.lines.length} lines (max recommended: 3)`);
    }

    if (trans) {
      // Paired: original + translation
      if (trans.lines.length > 3) {
        warnings.push(`Slide ${slideNum}: translation block has ${trans.lines.length} lines (max recommended: 3)`);
      }
      slides.push({
        label: orig.label || trans.label || `Slide ${slideNum}`,
        originalLines: orig.lines,
        translationLines: trans.lines,
      });
      i += 2;
    } else {
      // Odd block at the end — original only
      warnings.push(`Slide ${slideNum}: no translation found`);
      slides.push({
        label: orig.label || `Slide ${slideNum}`,
        originalLines: orig.lines,
        translationLines: [],
      });
      i++;
    }
    slideNum++;
  }

  return {
    title: titleFromFilename(filename),
    filename,
    slides,
    warnings,
  };
}
