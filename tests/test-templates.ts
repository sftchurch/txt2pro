// Template registry tests:
//  1. Regression — the refactored generator produces byte-equivalent main output
//     (decoded, UUID-stripped) to the pre-refactor baseline fixture.
//  2. Youth — single full-screen PT Serif box, middle-aligned, per-section
//     colored cue groups, merged original+translation text.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { generatePresentation } from '../src/lib/generator.js';
import { TEMPLATES, sectionColor } from '../src/lib/templates.js';
// @ts-ignore - generated static protobuf module
import { rv } from '../src/lib/proto-static.js';
import type { ParsedSong } from '../src/lib/types.js';

const Presentation = rv.data.Presentation;

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  ok: ${name}`);
  } else {
    failures++;
    console.error(`  FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function stripUuids(node: unknown): unknown {
  if (node && typeof node === 'object' && !Array.isArray(node)
      && Object.keys(node).length === 1 && typeof (node as { string?: unknown }).string === 'string'
      && /^[0-9A-F-]{36}$/i.test((node as { string: string }).string)) {
    return 'UUID';
  }
  if (Array.isArray(node)) return node.map(stripUuids);
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      out[k] = stripUuids(v);
    }
    return out;
  }
  return node;
}

function decodeStripped(bytes: Uint8Array): unknown {
  const msg = Presentation.decode(bytes);
  return stripUuids(Presentation.toObject(msg, { defaults: false, bytes: Array }));
}

function decode(bytes: Uint8Array): any {
  return Presentation.toObject(Presentation.decode(bytes), { defaults: false, bytes: String });
}

// Same input the baseline fixture was generated from (pre-refactor)
const BASELINE_SONGS: ParsedSong[] = [
  {
    title: 'Иисус Сегодня',
    filename: 'Иисус_Сегодня.txt',
    warnings: [],
    slides: [
      {
        label: 'Verse 1',
        originalLines: ['Иисус сегодня, Иисус вчера', 'Иисус вовеки, Иисус всегда'],
        translationLines: ['Jesus today, Jesus yesterday', 'Jesus forever, Jesus always'],
      },
      {
        label: 'Slide 2',
        originalLines: ['Без Него нет счастья, без Него беда'],
        translationLines: ['Without Him - no happiness'],
        origPt: 90,
        transPt: 80,
      },
    ],
  },
  {
    title: 'Amazing Grace',
    filename: 'Amazing_Grace.txt',
    warnings: [],
    slides: [
      {
        label: 'Chorus',
        originalLines: ['Amazing grace, how sweet the sound', 'That saved a wretch like me {braces} \\slash'],
        translationLines: [],
      },
    ],
  },
];

console.log('main template regression:');
{
  const fixturePath = fileURLToPath(new URL('./fixtures/main-baseline.json', import.meta.url));
  const baseline = JSON.parse(readFileSync(fixturePath, 'utf8'));
  const current = JSON.parse(JSON.stringify(decodeStripped(generatePresentation(BASELINE_SONGS))));
  const same = JSON.stringify(current) === JSON.stringify(baseline);
  check('default output identical to pre-refactor baseline', same);
  if (!same) {
    // Locate the first divergence for debugging
    const a = JSON.stringify(baseline, null, 1).split('\n');
    const b = JSON.stringify(current, null, 1).split('\n');
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (a[i] !== b[i]) {
        console.error(`    first diff at line ${i}:\n    baseline: ${a[i]}\n    current:  ${b[i]}`);
        break;
      }
    }
  }

  const explicit = decodeStripped(generatePresentation(BASELINE_SONGS, TEMPLATES.main));
  check('explicit TEMPLATES.main matches default', JSON.stringify(explicit) === JSON.stringify(current));
}

console.log('youth template:');
{
  const song: ParsedSong = {
    title: 'Свят Господь',
    filename: 'Свят_Господь.txt',
    warnings: [],
    slides: [
      { label: 'Verse 1', originalLines: ['Свят Господь всей земли', 'Достоин Ты хвалы'], translationLines: [] },
      { label: 'Slide 2', originalLines: ['Continuation of the verse'], translationLines: [] },
      { label: 'Chorus', originalLines: ['Аллилуйя'], translationLines: ['Hallelujah'] },
      { label: 'Custom Thing', originalLines: ['Something else'], translationLines: [] },
    ],
  };
  const p = decode(generatePresentation([song], TEMPLATES.youth));

  check('4 cues', p.cues.length === 4, `got ${p.cues?.length}`);

  const slide0 = p.cues[0].actions[0].slide.presentation.base_slide;
  check('single element per slide', slide0.elements.length === 1, `got ${slide0.elements.length}`);

  const el = slide0.elements[0].element;
  check('full-screen bounds', el.bounds.size.width === 1920 && el.bounds.size.height === 1080
    && !el.bounds.origin?.x && !el.bounds.origin?.y);
  check('PT Serif 100pt', el.text.attributes.font.name === 'PTSerif-Regular'
    && el.text.attributes.font.size === 100 && el.text.attributes.font.family === 'PT Serif');
  check('white text', el.text.attributes.text_solid_fill.red === 1
    && el.text.attributes.text_solid_fill.green === 1 && el.text.attributes.text_solid_fill.blue === 1);
  check('vertical_alignment MIDDLE', el.text.vertical_alignment === 1, `got ${el.text.vertical_alignment}`);

  const rtf0 = Buffer.from(p.cues[0].actions[0].slide.presentation.base_slide.elements[0].element.text.rtf_data, 'base64').toString('latin1');
  check('RTF uses fcharset204 + PTSerif-Regular', rtf0.includes('\\fcharset204 PTSerif-Regular'));
  check('RTF uses \\fs200 (100pt in half-points)', rtf0.includes('\\fs200'));
  check('RTF keeps \\cf2 marker', rtf0.includes('\\cf2'));

  // Slide 3 merges original + translation into the single box
  const rtf2 = Buffer.from(p.cues[2].actions[0].slide.presentation.base_slide.elements[0].element.text.rtf_data, 'base64').toString('latin1');
  check('merged box contains translation text', rtf2.includes('Hallelujah'));

  // Cue groups: Verse 1 (slides 1+2 — unlabeled continues the section),
  // Chorus (slide 3), Custom Thing (slide 4, default gray)
  check('3 cue groups', p.cue_groups.length === 3, `got ${p.cue_groups?.length}`);
  const [g0, g1, g2] = p.cue_groups;
  check('group names', g0.group.name === 'Verse 1' && g1.group.name === 'Chorus' && g2.group.name === 'Custom Thing',
    `got ${p.cue_groups.map((g: any) => g.group.name).join(', ')}`);
  check('unlabeled slide joins preceding section', g0.cue_identifiers.length === 2);
  const vc = sectionColor('Verse 1');
  check('Verse color', Math.abs(g0.group.color.red - vc.red) < 1e-9
    && Math.abs(g0.group.color.green - vc.green) < 1e-9 && Math.abs(g0.group.color.blue - vc.blue) < 1e-9);
  const cc = sectionColor('Chorus');
  check('Chorus color', Math.abs(g1.group.color.red - cc.red) < 1e-9 && Math.abs(g1.group.color.blue - cc.blue) < 1e-9);
  const dc = sectionColor('Custom Thing');
  check('unknown label falls back to gray', dc.red === 0.5 && g2.group.color.red === 0.5);

  check('cue ids match group identifiers', g0.cue_identifiers[0].string === p.cues[0].uuid.string
    && g1.cue_identifiers[0].string === p.cues[2].uuid.string);
}

console.log('youth template — fully unlabeled song:');
{
  const song: ParsedSong = {
    title: 'Plain',
    filename: 'plain.txt',
    warnings: [],
    slides: [
      { label: 'Slide 1', originalLines: ['a'], translationLines: [] },
      { label: 'Slide 2', originalLines: ['b'], translationLines: [] },
    ],
  };
  const p = decode(generatePresentation([song], TEMPLATES.youth));
  check('one unnamed group', p.cue_groups.length === 1 && p.cue_groups[0].group.name === ''
    && !p.cue_groups[0].group.color, `got ${p.cue_groups?.length} groups`);
  check('both cues in it', p.cue_groups[0].cue_identifiers.length === 2);
}

console.log('main template — zero-slide song keeps its empty group (pre-refactor behavior):');
{
  const song: ParsedSong = { title: 'Empty', filename: 'empty.txt', warnings: [], slides: [] };
  const p = decode(generatePresentation([song]));
  check('one empty unnamed group', p.cue_groups.length === 1 && !p.cue_groups[0].group.name
    && !p.cue_groups[0].group.color && !(p.cue_groups[0].cue_identifiers ?? []).length);
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log('\nAll template tests passed');
