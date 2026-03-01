import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import protobuf from 'protobufjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROTO_DIR = join(__dirname, '..', 'proto', 'Proto 19beta');

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: npx tsx scripts/dump-rtf.ts <file.pro>');
  process.exit(1);
}

const data = readFileSync(inputPath);
const root = new protobuf.Root();
root.resolvePath = (_origin: string, target: string) => join(PROTO_DIR, target);
await root.load('presentation.proto', { keepCase: true });

const Presentation = root.lookupType('rv.data.Presentation');
const decoded = Presentation.decode(data);
const obj = Presentation.toObject(decoded, {
  longs: Number,
  bytes: String,
  defaults: true,
  arrays: true,
  objects: true,
});

// Dump full RTF from first cue
const slide = (obj as any).cues[0].actions[0].slide.presentation.base_slide;
for (let i = 0; i < slide.elements.length; i++) {
  const el = slide.elements[i].element;
  const rtfBase64 = el.text.rtf_data;
  const rtfText = Buffer.from(rtfBase64, 'base64').toString('utf-8');
  console.log(`=== Element ${i} (${el.name}) RTF ===`);
  console.log(rtfText);
  console.log();
}
