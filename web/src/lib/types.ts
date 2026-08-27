export interface Service {
  id: string;
  service_date: string;
  title: string;
  current_version: number;
  template?: string | null;
  created_at: string;
  checksum: string | null;
  song_count: number | null;
  published_at: string | null;
}

export interface ClientSlide {
  original: string[];
  translation: string[];
  label?: string;
  origPt?: number;
  transPt?: number;
}

export interface ClientSong {
  title: string;
  filename: string;
  file: File;
  ok: boolean;
  warn: string | null;
  count: number;
  slides: ClientSlide[];
  section?: string;
  template?: string; // per-song override; unset = service template
}

export interface PublishResult {
  serviceId: string;
  version: number;
  checksum: string;
  songCount: number;
  downloadUrl: string;
}

export interface VersionInfo {
  id: number;
  service_id: string;
  version: number;
  song_count: number;
  checksum: string;
  note: string;
  published_at: string;
  songs: { filename: string; title: string; slide_count: number; sort_order: number }[];
}

export interface CalendarEvent {
  date: string;    // YYYY-MM-DD
  title: string;   // e.g. "Communion Service"
  time: string;    // e.g. "7:00 PM" or "All day"
}

export interface ServiceDetail {
  service: {
    id: string;
    service_date: string;
    title: string;
    current_version: number;
    template?: string | null;
    created_at: string;
  };
  versions: VersionInfo[];
}
