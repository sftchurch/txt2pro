import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import protobuf from 'protobufjs';
import { parseSongFile } from '../src/lib/parser.js';
import { generatePresentation } from '../src/lib/generator.js';
import { createProBundle } from '../src/lib/bundle.js';
import { DEFAULT_TEMPLATE } from '../src/lib/template.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROTO_DIR = join(__dirname, '..', 'proto', 'Proto 19beta');

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

async function main() {
  console.log('\n── End-to-End Test ──\n');

  // Step 1: Read and parse the fixture
  console.log('Step 1: Parse lyrics');
  const fixture = readFileSync(join(__dirname, 'fixtures', 'sample-lyrics.txt'), 'utf-8');
  const song = parseSongFile(fixture, 'Иисус_сегодня.txt');

  assert(song.slides.length > 0, `Parsed ${song.slides.length} slides`);
  console.log(`  Song: "${song.title}" with ${song.slides.length} slides`);
  if (song.warnings.length > 0) {
    console.log(`  Warnings: ${song.warnings.join(', ')}`);
  }

  // Step 2: Generate protobuf binary
  console.log('\nStep 2: Generate .pro file');
  const proData = await generatePresentation([song]);
  assert(proData.length > 0, `Generated ${proData.length} bytes of protobuf data`);

  // Write the .pro file
  const outputPath = join(__dirname, '..', 'test-service.pro');
  writeFileSync(outputPath, proData);
  console.log(`  Written to: test-service.pro`);

  // Step 3: Decode and verify the protobuf
  console.log('\nStep 3: Verify protobuf structure');
  const root = new protobuf.Root();
  root.resolvePath = (_origin: string, target: string) => join(PROTO_DIR, target);
  await root.load('presentation.proto', { keepCase: true });

  const Presentation = root.lookupType('rv.data.Presentation');
  const decoded = Presentation.decode(proData) as protobuf.Message & Record<string, unknown>;
  const decodedObj = Presentation.toObject(decoded, {
    longs: Number,
    bytes: Buffer,
    defaults: true,
  }) as Record<string, unknown>;

  // Verify basic structure
  assert(decodedObj.uuid !== null && decodedObj.uuid !== undefined, 'Presentation has UUID');
  assert(typeof decodedObj.name === 'string' && (decodedObj.name as string).length > 0, 'Presentation has name');
  console.log(`  Name: "${decodedObj.name}"`);

  // Verify cue groups (one per song)
  const cueGroups = decodedObj.cue_groups as Array<Record<string, unknown>>;
  assertEqual(cueGroups.length, 1, 'One cue group (one song)');

  // Verify cues
  const cues = decodedObj.cues as Array<Record<string, unknown>>;
  assertEqual(cues.length, song.slides.length, `${song.slides.length} cues match slide count`);

  // Verify each cue has the right structure
  console.log('\nStep 4: Verify slide contents');
  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    const actions = cue.actions as Array<Record<string, unknown>>;
    assert(actions.length > 0, `Cue ${i + 1} has actions`);

    const action = actions[0];
    assertEqual(action.type, 11, `Cue ${i + 1} action type is PRESENTATION_SLIDE (11)`);

    const slideType = action.slide as Record<string, unknown>;
    assert(slideType !== null && slideType !== undefined, `Cue ${i + 1} has slide data`);

    const presSlide = slideType?.presentation as Record<string, unknown>;
    assert(presSlide !== null && presSlide !== undefined, `Cue ${i + 1} has presentation slide`);

    const baseSlide = presSlide?.base_slide as Record<string, unknown>;
    assert(baseSlide !== null && baseSlide !== undefined, `Cue ${i + 1} has base slide`);

    const elements = baseSlide?.elements as Array<Record<string, unknown>>;
    assert(elements !== null && elements !== undefined && elements.length > 0, `Cue ${i + 1} has elements`);

    // Check slide size
    const size = baseSlide?.size as Record<string, unknown>;
    if (size) {
      assertEqual(size.width, 1920, `Cue ${i + 1} width is 1920`);
      assertEqual(size.height, 1080, `Cue ${i + 1} height is 1080`);
    }

    // Check RTF data present on text elements
    for (const elem of elements) {
      const graphicsElem = elem.element as Record<string, unknown>;
      const text = graphicsElem?.text as Record<string, unknown>;
      assert(
        text?.rtf_data !== null && text?.rtf_data !== undefined,
        `Cue ${i + 1} element "${graphicsElem?.name}" has RTF data`,
      );
    }
  }

  // Verify no arrangements (matches template.pro format)
  const arrangements = decodedObj.arrangements as Array<Record<string, unknown>>;
  assertEqual(arrangements.length, 0, 'No arrangements (matches template)');

  // Verify cue group has empty name (matches template.pro format)
  const group = (cueGroups[0] as Record<string, unknown>).group as Record<string, unknown>;
  assertEqual(group?.name, '', 'Group has empty name (matches template)');

  // Verify cue completion_action_type is 1
  assertEqual(cues[0].completion_action_type, 1, 'Cue completion_action_type is 1');

  // Verify element info is 3 (IS_TEMPLATE_ELEMENT | IS_TEXT_ELEMENT)
  const firstElements = (((cues[0].actions as any[])[0].slide as any).presentation.base_slide.elements) as any[];
  assertEqual(firstElements[0].info, 3, 'Element info is 3');

  // Verify element order: Translated first, Main second
  assertEqual((firstElements[0].element as any).name, 'Translated', 'First element is Translated');
  assertEqual((firstElements[1].element as any).name, 'Main', 'Second element is Main');

  // Step 5: Test bundle creation
  console.log('\nStep 5: Create .proBundle');
  const bundleData = createProBundle([
    { name: song.title, data: proData },
  ]);
  assert(bundleData.length > 0, `Bundle created: ${bundleData.length} bytes`);

  // Verify it's a valid ZIP (starts with PK)
  assert(bundleData[0] === 0x50 && bundleData[1] === 0x4B, 'Bundle is a valid ZIP file (PK signature)');

  const bundlePath = join(__dirname, '..', 'test-service.proBundle');
  writeFileSync(bundlePath, bundleData);
  console.log(`  Written to: test-service.proBundle`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n── Results: ${passed} passed, ${failed} failed ──\n`);
  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error('E2E test failed:', err);
  process.exit(1);
});
