import type { ClientSong, ClientSlide } from './types';

// Rebuild a File object from slides so published/draft songs round-trip identically
export function slidesToFile(slides: ClientSlide[], filename: string): File {
  const text = slides.map(s => {
    const parts: string[] = [];
    if (s.original.length > 0) parts.push(s.original.join('\n'));
    if (s.translation.length > 0) parts.push(s.translation.join('\n'));
    // Real section labels ([Verse 1]…) re-import as labels; auto "Slide N" don't
    if (parts.length > 0 && s.label && !/^Slide \d+$/.test(s.label)) {
      parts[0] = `[${s.label}]\n${parts[0]}`;
    }
    return parts.join('\n\n');
  }).join('\n\n');
  return new File([text], filename, { type: 'text/plain' });
}

const PREFIX = 'txt2pro:draft:';
const keyFor = (serviceId: string) => `${PREFIX}${serviceId}`;

interface DraftSongData {
  title: string;
  filename: string;
  section?: string;
  template?: string;
  slides: ClientSlide[];
}

export interface Draft {
  savedAt: number;
  baseVersion: number;
  serviceTemplate?: string;
  songs: DraftSongData[];
}

// Persist in-progress edits locally so a refresh / navigation doesn't lose them.
// File objects aren't serializable, so we store only the slide data and rebuild on load.
export function saveDraft(serviceId: string, baseVersion: number, songs: ClientSong[], savedAt: number, serviceTemplate?: string) {
  try {
    const data: Draft = {
      savedAt,
      baseVersion,
      serviceTemplate,
      songs: songs.map(s => ({
        title: s.title,
        filename: s.filename,
        section: s.section,
        template: s.template,
        slides: s.slides,
      })),
    };
    localStorage.setItem(keyFor(serviceId), JSON.stringify(data));
  } catch {
    // Storage full or disabled (private mode) — nothing we can do, fail silently
  }
}

export function loadDraft(serviceId: string): Draft | null {
  try {
    const raw = localStorage.getItem(keyFor(serviceId));
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    if (!d || !Array.isArray(d.songs)) return null;
    return d;
  } catch {
    return null;
  }
}

export function removeDraft(serviceId: string) {
  try {
    localStorage.removeItem(keyFor(serviceId));
  } catch {
    // ignore
  }
}

export function draftToSongs(d: Draft): ClientSong[] {
  return d.songs.map(s => ({
    title: s.title,
    filename: s.filename,
    section: s.section,
    template: s.template,
    slides: s.slides,
    count: s.slides.length,
    ok: true,
    warn: null,
    file: slidesToFile(s.slides, s.filename),
  }));
}
