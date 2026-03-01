import { stripRtf } from './rtf-strip.js';
import type { ParsedSong, ParsedSlide } from './types.js';

function isCyrillic(text: string): boolean {
  let cyrillic = 0;
  let latin = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code >= 0x0400 && code <= 0x04FF) cyrillic++;
    else if ((code >= 0x41 && code <= 0x5A) || (code >= 0x61 && code <= 0x7A)) latin++;
  }
  return cyrillic > latin;
}

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

  // Split into blocks by double-newline
  const rawBlocks = content.split(/\n{2,}/).filter(b => b.trim().length > 0);

  const warnings: string[] = [];
  const slides: ParsedSlide[] = [];

  // Process blocks: extract labels and detect language
  const blocks: Array<{ label: string | null; text: string; lines: string[]; isCyr: boolean }> = [];
  for (const raw of rawBlocks) {
    const { label, text } = extractLabel(raw.trim());
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    if (lines.length === 0) continue;
    blocks.push({
      label,
      text,
      lines,
      isCyr: isCyrillic(text),
    });
  }

  // Try to pair blocks: alternating Cyrillic/Latin
  let slideNum = 1;
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];

    // Check for line warnings
    for (const line of block.lines) {
      if (line.length > 50) {
        warnings.push(`Slide ${slideNum}: line exceeds 50 chars: "${line.slice(0, 40)}..."`);
      }
    }
    if (block.lines.length > 3) {
      warnings.push(`Slide ${slideNum}: block has ${block.lines.length} lines (max recommended: 3)`);
    }

    // Check if next block is a translation pair
    const next = blocks[i + 1];
    if (next && block.isCyr && !next.isCyr) {
      // Paired: Cyrillic original + English translation
      for (const line of next.lines) {
        if (line.length > 50) {
          warnings.push(`Slide ${slideNum}: translation line exceeds 50 chars: "${line.slice(0, 40)}..."`);
        }
      }
      if (next.lines.length > 3) {
        warnings.push(`Slide ${slideNum}: translation block has ${next.lines.length} lines (max recommended: 3)`);
      }

      slides.push({
        label: block.label || next.label || `Slide ${slideNum}`,
        originalLines: block.lines,
        translationLines: next.lines,
      });
      i += 2;
    } else {
      // Unpaired block
      if (block.isCyr) {
        warnings.push(`Slide ${slideNum}: no translation found`);
      }
      slides.push({
        label: block.label || `Slide ${slideNum}`,
        originalLines: block.isCyr ? block.lines : [],
        translationLines: block.isCyr ? [] : block.lines,
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
