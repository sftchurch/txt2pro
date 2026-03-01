import { parseSongFile } from '../../src/lib/parser.js';
import { generatePresentation } from '../../src/lib/generator.js';
import { createProBundle } from '../../src/lib/bundle.js';

interface Env {
  BUCKET: R2Bucket;
  DB: D1Database;
}

type Handler = (request: Request, env: Env, params: Record<string, string>) => Promise<Response>;

const routes: { method: string; pattern: RegExp; paramNames: string[]; handler: Handler }[] = [];

function route(method: string, path: string, handler: Handler) {
  const paramNames: string[] = [];
  const pattern = path.replace(/:(\w+)/g, (_, name) => {
    paramNames.push(name);
    return '([^/]+)';
  });
  routes.push({ method, pattern: new RegExp(`^${pattern}$`), paramNames, handler });
}

function matchRoute(method: string, pathname: string) {
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = pathname.match(r.pattern);
    if (m) {
      const params: Record<string, string> = {};
      r.paramNames.forEach((name, i) => { params[name] = m[i + 1]; });
      return { handler: r.handler, params };
    }
  }
  return null;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status = 400): Response {
  return json({ error: message }, status);
}

async function sha256(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// POST /api/services — Upload songs, generate .proBundle, store
route('POST', '/api/services', async (request, env) => {
  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return errorResponse('Content-Type must be multipart/form-data');
  }

  const formData = await request.formData();
  const title = formData.get('title') as string | null;
  const serviceDate = formData.get('date') as string | null;
  const note = (formData.get('note') as string) || '';

  if (!title) return errorResponse('Missing required field: title');
  if (!serviceDate) return errorResponse('Missing required field: date');

  // Check for structured slide data (from edited songs)
  const slidesJson = formData.get('slides_json') as string | null;

  // Collect song files
  const songFiles: { filename: string; content: string }[] = [];
  for (const [key, value] of formData.entries()) {
    if (key === 'songs' && value instanceof File) {
      const text = await value.text();
      songFiles.push({ filename: value.name, content: text });
    }
  }

  let parsedSongs: ReturnType<typeof parseSongFile>[];

  if (slidesJson) {
    // Use pre-parsed slide data (preserves original/translation positions from edits)
    const structured = JSON.parse(slidesJson) as {
      title: string;
      filename: string;
      slides: { original: string[]; translation: string[] }[];
    }[];
    parsedSongs = structured.map(s => ({
      title: s.title,
      filename: s.filename,
      slides: s.slides.map((sl, i) => ({
        label: `Slide ${i + 1}`,
        originalLines: sl.original,
        translationLines: sl.translation,
      })),
      warnings: [],
    }));
  } else {
    if (songFiles.length === 0) {
      return errorResponse('No song files uploaded. Use field name "songs"');
    }
    // Parse all songs from raw text files
    parsedSongs = songFiles.map(f => parseSongFile(f.content, f.filename));
  }

  // Generate individual .pro files per song
  const bundleFiles = parsedSongs.map(song => ({
    name: song.title,
    data: generatePresentation([song]),
  }));
  const bundleData = createProBundle(bundleFiles);
  const checksum = await sha256(bundleData);

  // Build lyrics JSON
  const lyricsData = parsedSongs.map(song => ({
    title: song.title,
    filename: song.filename,
    slides: song.slides.map(s => ({
      label: s.label,
      original: s.originalLines,
      translation: s.translationLines,
    })),
  }));

  // Check if a service for this date already exists
  const existing = await env.DB.prepare(
    'SELECT id, current_version FROM services WHERE service_date = ?'
  ).bind(serviceDate).first<{ id: string; current_version: number }>();

  const serviceId = existing ? existing.id : crypto.randomUUID();
  const version = existing ? existing.current_version + 1 : 1;
  const r2Prefix = `services/${serviceId}/v${version}`;

  // Store in R2
  await Promise.all([
    env.BUCKET.put(`${r2Prefix}/service.proBundle`, bundleData),
    env.BUCKET.put(`${r2Prefix}/lyrics.json`, JSON.stringify(lyricsData)),
    ...songFiles.map(f =>
      env.BUCKET.put(`${r2Prefix}/songs/${f.filename}`, f.content)
    ),
    ...bundleFiles.map((bf, i) =>
      env.BUCKET.put(`${r2Prefix}/pro/${i}.pro`, bf.data)
    ),
  ]);

  // Insert or update service, add new version
  if (existing) {
    await env.DB.batch([
      env.DB.prepare(
        'UPDATE services SET title = ?, current_version = ? WHERE id = ?'
      ).bind(title, version, serviceId),
      env.DB.prepare(
        'INSERT INTO versions (service_id, version, song_count, checksum, note) VALUES (?, ?, ?, ?, ?)'
      ).bind(serviceId, version, parsedSongs.length, checksum, note),
    ]);
  } else {
    await env.DB.batch([
      env.DB.prepare(
        'INSERT INTO services (id, service_date, title, current_version) VALUES (?, ?, ?, ?)'
      ).bind(serviceId, serviceDate, title, version),
      env.DB.prepare(
        'INSERT INTO versions (service_id, version, song_count, checksum, note) VALUES (?, ?, ?, ?, ?)'
      ).bind(serviceId, version, parsedSongs.length, checksum, note),
    ]);
  }

  // Get the version_id, then insert songs
  const versionRow = await env.DB.prepare(
    'SELECT id FROM versions WHERE service_id = ? AND version = ?'
  ).bind(serviceId, version).first<{ id: number }>();

  if (versionRow && parsedSongs.length > 0) {
    await env.DB.batch(
      parsedSongs.map((song, i) =>
        env.DB.prepare(
          'INSERT INTO songs (version_id, filename, title, slide_count, sort_order) VALUES (?, ?, ?, ?, ?)'
        ).bind(versionRow.id, song.filename, song.title, song.slides.length, i)
      )
    );
  }

  return json({
    serviceId,
    version,
    checksum,
    songCount: parsedSongs.length,
    downloadUrl: `/api/services/${serviceId}/v/${version}/download`,
  }, 201);
});

// POST /api/services/new — Create an empty service (no songs yet)
route('POST', '/api/services/new', async (request, env) => {
  const body = await request.json() as { title?: string; date?: string };
  const title = body.title;
  const serviceDate = body.date;

  if (!title) return errorResponse('Missing required field: title');
  if (!serviceDate) return errorResponse('Missing required field: date');

  // Check if a service for this date already exists
  const existing = await env.DB.prepare(
    'SELECT id, service_date, title, current_version FROM services WHERE service_date = ?'
  ).bind(serviceDate).first<{ id: string; service_date: string; title: string; current_version: number }>();

  if (existing) {
    return json(existing);
  }

  const serviceId = crypto.randomUUID();
  await env.DB.prepare(
    'INSERT INTO services (id, service_date, title, current_version) VALUES (?, ?, ?, 0)'
  ).bind(serviceId, serviceDate, title).run();

  return json({ id: serviceId, service_date: serviceDate, title, current_version: 0 }, 201);
});

// GET /api/services — List all services
route('GET', '/api/services', async (_request, env) => {
  const { results } = await env.DB.prepare(
    `SELECT s.id, s.service_date, s.title, s.current_version, s.created_at,
            v.checksum, v.song_count, v.published_at
     FROM services s
     LEFT JOIN versions v ON v.service_id = s.id AND v.version = s.current_version
     ORDER BY s.service_date DESC`
  ).all();

  return json({ services: results });
});

// GET /api/services/:id — Service manifest with all versions
route('GET', '/api/services/:id', async (_request, env, params) => {
  const service = await env.DB.prepare(
    'SELECT * FROM services WHERE id = ?'
  ).bind(params.id).first();

  if (!service) return errorResponse('Service not found', 404);

  const { results: versions } = await env.DB.prepare(
    'SELECT * FROM versions WHERE service_id = ? ORDER BY version DESC'
  ).bind(params.id).all();

  // Get songs for each version
  const versionsWithSongs = await Promise.all(
    versions.map(async (v) => {
      const { results: songs } = await env.DB.prepare(
        'SELECT filename, title, slide_count, sort_order FROM songs WHERE version_id = ? ORDER BY sort_order'
      ).bind(v.id).all();
      return { ...v, songs };
    })
  );

  return json({ service, versions: versionsWithSongs });
});

// GET /api/services/:id/v/:version/download — Download .proBundle
route('GET', '/api/services/:id/v/:version/download', async (_request, env, params) => {
  const service = await env.DB.prepare(
    'SELECT service_date FROM services WHERE id = ?'
  ).bind(params.id).first<{ service_date: string }>();

  const key = `services/${params.id}/v${params.version}/service.proBundle`;
  const object = await env.BUCKET.get(key);

  if (!object) return errorResponse('Bundle not found', 404);

  const filename = service
    ? `${service.service_date}_v${params.version}.proBundle`
    : 'service.proBundle';

  return new Response(object.body, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});

// GET /api/services/:id/v/:version/songs/:index/pro — Download individual .pro file
route('GET', '/api/services/:id/v/:version/songs/:index/pro', async (_request, env, params) => {
  const songRow = await env.DB.prepare(
    `SELECT s.title FROM songs s
     JOIN versions v ON v.id = s.version_id
     WHERE v.service_id = ? AND v.version = ? AND s.sort_order = ?`
  ).bind(params.id, Number(params.version), Number(params.index)).first<{ title: string }>();

  const key = `services/${params.id}/v${params.version}/pro/${params.index}.pro`;
  const object = await env.BUCKET.get(key);

  if (!object) return errorResponse('Song file not found', 404);

  const filename = songRow ? `${songRow.title}.pro` : `song_${params.index}.pro`;

  return new Response(object.body, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});

// GET /api/services/:id/v/:version/lyrics — Lyrics JSON
route('GET', '/api/services/:id/v/:version/lyrics', async (_request, env, params) => {
  const key = `services/${params.id}/v${params.version}/lyrics.json`;
  const object = await env.BUCKET.get(key);

  if (!object) return errorResponse('Lyrics not found', 404);

  return new Response(object.body, {
    headers: { 'Content-Type': 'application/json' },
  });
});

// GET /api/services/:id/latest/download — Latest version download
route('GET', '/api/services/:id/latest/download', async (_request, env, params) => {
  const service = await env.DB.prepare(
    'SELECT service_date, current_version FROM services WHERE id = ?'
  ).bind(params.id).first<{ service_date: string; current_version: number }>();

  if (!service) return errorResponse('Service not found', 404);

  const key = `services/${params.id}/v${service.current_version}/service.proBundle`;
  const object = await env.BUCKET.get(key);

  if (!object) return errorResponse('Bundle not found', 404);

  const filename = `${service.service_date}_v${service.current_version}.proBundle`;

  return new Response(object.body, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});

// GET /api/sync/check — Sync polling (returns latest checksum per service)
route('GET', '/api/sync/check', async (request, env) => {
  const url = new URL(request.url);
  const serviceId = url.searchParams.get('serviceId');

  if (serviceId) {
    const row = await env.DB.prepare(
      `SELECT v.checksum, v.version, v.published_at
       FROM services s
       JOIN versions v ON v.service_id = s.id AND v.version = s.current_version
       WHERE s.id = ?`
    ).bind(serviceId).first();

    if (!row) return errorResponse('Service not found', 404);
    return json(row);
  }

  // Return all services' latest checksums
  const { results } = await env.DB.prepare(
    `SELECT s.id as service_id, v.checksum, v.version, v.published_at
     FROM services s
     JOIN versions v ON v.service_id = s.id AND v.version = s.current_version
     ORDER BY v.published_at DESC`
  ).all();

  return json({ services: results });
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const match = matchRoute(request.method, url.pathname);

    if (!match) {
      return errorResponse('Not found', 404);
    }

    try {
      const response = await match.handler(request, env, match.params);
      for (const [k, v] of Object.entries(corsHeaders)) {
        response.headers.set(k, v);
      }
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error';
      console.error('Handler error:', err);
      return errorResponse(message, 500);
    }
  },
};
