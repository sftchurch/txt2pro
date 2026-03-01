CREATE TABLE services (
  id TEXT PRIMARY KEY,
  service_date TEXT NOT NULL,
  title TEXT NOT NULL,
  current_version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id TEXT NOT NULL REFERENCES services(id),
  version INTEGER NOT NULL,
  song_count INTEGER NOT NULL,
  checksum TEXT NOT NULL,
  note TEXT DEFAULT '',
  published_at TEXT DEFAULT (datetime('now')),
  UNIQUE(service_id, version)
);

CREATE TABLE songs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version_id INTEGER NOT NULL REFERENCES versions(id),
  filename TEXT NOT NULL,
  title TEXT NOT NULL,
  slide_count INTEGER NOT NULL,
  sort_order INTEGER NOT NULL
);
