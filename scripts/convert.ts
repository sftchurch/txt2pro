import { readFileSync, writeFileSync } from 'fs';
import { basename, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseSongFile } from '../src/lib/parser.js';
import { generatePresentation } from '../src/lib/generator.js';
import { stripRtf } from '../src/lib/rtf-strip.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: npx tsx scripts/convert.ts <input-file>');
  process.exit(1);
}

const filename = basename(inputPath);
const content = readFileSync(inputPath, 'utf-8');

// Show stripped text for debugging
console.log('=== Stripped text ===');
const stripped = stripRtf(content);
console.log(stripped);
console.log('=== End stripped text ===\n');

// Parse
const song = parseSongFile(content, filename);
console.log(`Song: "${song.title}"`);
console.log(`Slides: ${song.slides.length}`);
if (song.warnings.length > 0) {
  console.log(`Warnings:`);
  song.warnings.forEach(w => console.log(`  - ${w}`));
}
console.log();

for (let i = 0; i < song.slides.length; i++) {
  const s = song.slides[i];
  console.log(`--- ${s.label} ---`);
  console.log(`  Original:    ${s.originalLines.join(' / ')}`);
  console.log(`  Translation: ${s.translationLines.join(' / ')}`);
}

// Generate
console.log('\nGenerating .pro file...');
const proData = await generatePresentation([song]);
const outputPath = join(__dirname, '..', `${song.title}.pro`);
writeFileSync(outputPath, proData);
console.log(`Written: ${outputPath} (${proData.length} bytes)`);
