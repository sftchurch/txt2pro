import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseSongFile } from '../src/lib/parser.js';
import { stripRtf } from '../src/lib/rtf-strip.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.log(`  ✗ ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual === expected) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.log(`  ✗ ${message}`);
    console.log(`    expected: ${JSON.stringify(expected)}`);
    console.log(`    actual:   ${JSON.stringify(actual)}`);
  }
}

// ── Test: Parse sample lyrics ───────────────────────────────────────────────
console.log('\n── Parser Tests ──');

const fixture = readFileSync(join(__dirname, 'fixtures', 'sample-lyrics.txt'), 'utf-8');
const song = parseSongFile(fixture, 'Иисус_сегодня.txt');

console.log('\nBasic parsing:');
assertEqual(song.title, 'Иисус Сегодня', 'Title extracted and formatted from filename');
assertEqual(song.filename, 'Иисус_сегодня.txt', 'Original filename preserved');
assertEqual(song.slides.length, 5, 'Correct number of slides (5 paired blocks)');

console.log('\nSlide pairing:');
assertEqual(song.slides[0].originalLines[0], 'Иисус сегодня, Иисус вчера', 'First slide original text correct');
assertEqual(song.slides[0].translationLines[0], 'Jesus today, Jesus yesterday', 'First slide translation text correct');
assertEqual(song.slides[0].originalLines.length, 2, 'First slide has 2 original lines');
assertEqual(song.slides[0].translationLines.length, 2, 'First slide has 2 translation lines');

console.log('\nSection labels:');
assertEqual(song.slides[2].label, 'Chorus', 'Section label [Chorus] extracted');
assertEqual(song.slides[0].label, 'Slide 1', 'Auto-numbered slide label when no section');

console.log('\nCyrillic detection:');
assert(song.slides[0].originalLines.every(l =>
  /[\u0400-\u04FF]/.test(l)
), 'Original lines contain Cyrillic');
assert(song.slides[0].translationLines.every(l =>
  /[a-zA-Z]/.test(l)
), 'Translation lines contain Latin');

// ── Test: RTF stripping ─────────────────────────────────────────────────────
console.log('\n── RTF Strip Tests ──');

const rtfSample = String.raw`{\rtf1\ansi{\fonttbl{\f0 Arial;}}{\colortbl;\red0\green0\blue0;}\pard\f0\fs24 Hello World\par Second line}`;
const stripped = stripRtf(rtfSample);
console.log('\nBasic RTF stripping:');
assert(stripped.includes('Hello World'), 'Plain text extracted from RTF');
assert(stripped.includes('Second line'), 'Second line preserved after \\par');
assert(!stripped.includes('\\rtf'), 'RTF commands removed');
assert(!stripped.includes('fonttbl'), 'Font table removed');

console.log('\nCyrillic RTF hex escapes:');
// \'c0 in Windows-1251 = А (Cyrillic A, U+0410)
const cyrillicRtf = String.raw`{\rtf1\ansi\deff0 \'c0\'e1}`;
const cyrStripped = stripRtf(cyrillicRtf);
assert(cyrStripped.includes('А'), 'Windows-1251 0xC0 → Cyrillic А');
assert(cyrStripped.includes('б'), 'Windows-1251 0xE1 → Cyrillic б');

console.log('\nSpecial character escapes:');
const specialRtf = String.raw`{\rtf1\ansi\deff0 test\rquote s \ldblquote hello\rdblquote}`;
const specialStripped = stripRtf(specialRtf);
assert(specialStripped.includes('\u2019'), 'Right single quote converted');
assert(specialStripped.includes('\u201C'), 'Left double quote converted');
assert(specialStripped.includes('\u201D'), 'Right double quote converted');

console.log('\nNon-RTF passthrough:');
const plainText = 'Just plain text\nWith lines';
assertEqual(stripRtf(plainText), plainText, 'Non-RTF content passes through unchanged');

// ── Test: Edge cases ────────────────────────────────────────────────────────
console.log('\n── Edge Case Tests ──');

console.log('\nUnpaired blocks:');
const unpairedContent = 'Только русский текст\nБез перевода';
const unpairedSong = parseSongFile(unpairedContent, 'unpaired.txt');
assertEqual(unpairedSong.slides.length, 1, 'Single unpaired block creates one slide');
assert(unpairedSong.warnings.some(w => w.includes('no translation')), 'Warning generated for missing translation');

console.log('\nEmpty content:');
const emptySong = parseSongFile('', 'empty.txt');
assertEqual(emptySong.slides.length, 0, 'Empty content produces no slides');

console.log('\nTitle formatting:');
const titleSong = parseSongFile('test', 'my_great_song.txt');
assertEqual(titleSong.title, 'My Great Song', 'Underscores replaced and title-cased');

const rtfTitleSong = parseSongFile('test', 'song_file.rtf');
assertEqual(rtfTitleSong.title, 'Song File', 'RTF extension stripped from title');

// ── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n── Results: ${passed} passed, ${failed} failed ──\n`);
if (failed > 0) process.exit(1);
