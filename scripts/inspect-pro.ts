import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import protobuf from 'protobufjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROTO_DIR = join(__dirname, '..', 'proto', 'Proto 19beta');

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: npx tsx scripts/inspect-pro.ts <file.pro>');
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
  bytes: String, // base64
  defaults: true,
  arrays: true,
  objects: true,
});

// Print full structure but truncate rtf_data fields for readability
function truncateRtf(o: unknown, depth = 0): unknown {
  if (depth > 20) return '...';
  if (Array.isArray(o)) return o.map(x => truncateRtf(x, depth + 1));
  if (o && typeof o === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (k === 'rtf_data' && typeof v === 'string') {
        // Decode base64 to show actual RTF text
        const buf = Buffer.from(v, 'base64');
        result[k] = buf.toString('utf-8').slice(0, 200) + (buf.length > 200 ? '...' : '');
      } else {
        result[k] = truncateRtf(v, depth + 1);
      }
    }
    return result;
  }
  return o;
}

console.log(JSON.stringify(truncateRtf(obj), null, 2));
