export interface Service {
  id: string;
  service_date: string;
  title: string;
  current_version: number;
  created_at: string;
  checksum: string | null;
  song_count: number | null;
  published_at: string | null;
}

export interface ClientSlide {
  original: string[];
  translation: string[];
}

export interface ClientSong {
  title: string;
  filename: string;
  file: File;
  ok: boolean;
  warn: string | null;
  count: number;
  slides: ClientSlide[];
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

export interface ServiceDetail {
  service: {
    id: string;
    service_date: string;
    title: string;
    current_version: number;
    created_at: string;
  };
  versions: VersionInfo[];
}
