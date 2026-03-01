import { zipSync } from 'fflate';

export function createProBundle(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const zipData: Record<string, Uint8Array> = {};
  for (const file of files) {
    const key = file.name.endsWith('.pro') ? file.name : `${file.name}.pro`;
    zipData[key] = file.data;
  }
  return zipSync(zipData);
}
