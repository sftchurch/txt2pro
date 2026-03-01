import type { Service, PublishResult, ServiceDetail } from './types';

const BASE = import.meta.env.VITE_API_URL as string;

export async function fetchServices(): Promise<Service[]> {
  const res = await fetch(`${BASE}/api/services`);
  if (!res.ok) throw new Error('Failed to fetch services');
  const data = await res.json();
  return data.services;
}

export async function fetchService(id: string): Promise<ServiceDetail> {
  const res = await fetch(`${BASE}/api/services/${id}`);
  if (!res.ok) throw new Error('Failed to fetch service');
  return res.json();
}

export async function publishService(
  title: string,
  date: string,
  songs: { title: string; filename: string; file: File | null; slides: { original: string[]; translation: string[] }[] }[],
  note: string,
): Promise<PublishResult> {
  const fd = new FormData();
  fd.append('title', title);
  fd.append('date', date);
  if (note) fd.append('note', note);

  // Send structured slide JSON so the worker preserves original/translation positions
  const slidesJson = songs.map(s => ({
    title: s.title,
    filename: s.filename,
    slides: s.slides.map(sl => ({ original: sl.original, translation: sl.translation })),
  }));
  fd.append('slides_json', JSON.stringify(slidesJson));

  // Also send raw files for any songs that have them (for R2 storage)
  for (const s of songs) {
    if (s.file) fd.append('songs', s.file);
  }

  const res = await fetch(`${BASE}/api/services`, { method: 'POST', body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Publish failed' }));
    throw new Error(err.error);
  }
  return res.json();
}

export function downloadUrl(id: string, version: number): string {
  return `${BASE}/api/services/${id}/v/${version}/download`;
}

export function songProUrl(id: string, version: number, index: number): string {
  return `${BASE}/api/services/${id}/v/${version}/songs/${index}/pro`;
}

export async function createService(title: string, date: string): Promise<{ id: string; service_date: string; title: string; current_version: number }> {
  const res = await fetch(`${BASE}/api/services/new`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, date }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to create service' }));
    throw new Error(err.error);
  }
  return res.json();
}

export async function fetchLyrics(id: string, version: number) {
  const res = await fetch(`${BASE}/api/services/${id}/v/${version}/lyrics`);
  if (!res.ok) throw new Error('Failed to fetch lyrics');
  return res.json();
}
