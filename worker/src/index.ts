import { parseSongFile } from '../../src/lib/parser.js';
import { generatePresentation } from '../../src/lib/generator.js';
import { createProBundle } from '../../src/lib/bundle.js';
import { TEMPLATES, isTemplateId, type TemplateId } from '../../src/lib/templates.js';

interface Env {
  BUCKET: R2Bucket;
  DB: D1Database;
  ICAL_URL: string;
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
  const templateField = formData.get('template') as string | null;

  if (!title) return errorResponse('Missing required field: title');
  if (!serviceDate) return errorResponse('Missing required field: date');
  if (templateField && !isTemplateId(templateField)) {
    return errorResponse(`Unknown template: ${templateField}`);
  }

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
  // Per-song template overrides, parallel to parsedSongs (null = service default)
  let songTemplates: (TemplateId | null)[];

  if (slidesJson) {
    // Use pre-parsed slide data (preserves original/translation positions from edits)
    const structured = JSON.parse(slidesJson) as {
      title: string;
      filename: string;
      template?: string;
      slides: { original: string[]; translation: string[]; label?: string; origPt?: number; transPt?: number }[];
    }[];
    for (const s of structured) {
      if (s.template && !isTemplateId(s.template)) {
        return errorResponse(`Unknown template on song "${s.title}": ${s.template}`);
      }
    }
    parsedSongs = structured.map(s => ({
      title: s.title,
      filename: s.filename,
      slides: s.slides.map((sl, i) => ({
        label: sl.label || `Slide ${i + 1}`,
        originalLines: sl.original,
        translationLines: sl.translation,
        origPt: sl.origPt,
        transPt: sl.transPt,
      })),
      warnings: [],
    }));
    songTemplates = structured.map(s => (isTemplateId(s.template) ? s.template : null));
  } else {
    if (songFiles.length === 0) {
      return errorResponse('No song files uploaded. Use field name "songs"');
    }
    // Parse all songs from raw text files
    parsedSongs = songFiles.map(f => parseSongFile(f.content, f.filename));
    songTemplates = parsedSongs.map(() => null);
  }

  // Check if a service for this date already exists
  const existing = await env.DB.prepare(
    'SELECT id, current_version, template FROM services WHERE service_date = ?'
  ).bind(serviceDate).first<{ id: string; current_version: number; template: string | null }>();

  // Service-level template: explicit field wins, then the stored value, then main
  const serviceTemplate: TemplateId = isTemplateId(templateField)
    ? templateField
    : (isTemplateId(existing?.template) ? existing!.template as TemplateId : 'main');

  // Generate individual .pro files per song, each with its resolved template
  const bundleFiles = parsedSongs.map((song, i) => ({
    name: song.title,
    data: generatePresentation([song], TEMPLATES[songTemplates[i] ?? serviceTemplate]),
  }));
  const bundleData = createProBundle(bundleFiles);
  const checksum = await sha256(bundleData);

  // Build lyrics JSON
  const lyricsData = parsedSongs.map((song, i) => ({
    title: song.title,
    filename: song.filename,
    ...(songTemplates[i] ? { template: songTemplates[i] } : {}),
    slides: song.slides.map(s => ({
      label: s.label,
      original: s.originalLines,
      translation: s.translationLines,
      ...(s.origPt ? { origPt: s.origPt } : {}),
      ...(s.transPt ? { transPt: s.transPt } : {}),
    })),
  }));

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
        'UPDATE services SET title = ?, current_version = ?, template = ? WHERE id = ?'
      ).bind(title, version, serviceTemplate, serviceId),
      env.DB.prepare(
        'INSERT INTO versions (service_id, version, song_count, checksum, note, template) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(serviceId, version, parsedSongs.length, checksum, note, serviceTemplate),
    ]);
  } else {
    await env.DB.batch([
      env.DB.prepare(
        'INSERT INTO services (id, service_date, title, current_version, template) VALUES (?, ?, ?, ?, ?)'
      ).bind(serviceId, serviceDate, title, version, serviceTemplate),
      env.DB.prepare(
        'INSERT INTO versions (service_id, version, song_count, checksum, note, template) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(serviceId, version, parsedSongs.length, checksum, note, serviceTemplate),
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
          'INSERT INTO songs (version_id, filename, title, slide_count, sort_order, template) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(versionRow.id, song.filename, song.title, song.slides.length, i, songTemplates[i])
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
  const body = await request.json() as { title?: string; date?: string; template?: string };
  const title = body.title;
  const serviceDate = body.date;
  const template = body.template;

  if (!title) return errorResponse('Missing required field: title');
  if (!serviceDate) return errorResponse('Missing required field: date');
  if (template && !isTemplateId(template)) return errorResponse(`Unknown template: ${template}`);

  // Check if a service for this date already exists
  const existing = await env.DB.prepare(
    'SELECT id, service_date, title, current_version, template FROM services WHERE service_date = ?'
  ).bind(serviceDate).first<{ id: string; service_date: string; title: string; current_version: number; template: string | null }>();

  if (existing) {
    // A never-published service can still adopt the requested template;
    // published ones keep theirs (the caller sees the stored value)
    if (template && existing.current_version === 0 && template !== existing.template) {
      await env.DB.prepare('UPDATE services SET template = ? WHERE id = ?').bind(template, existing.id).run();
      return json({ ...existing, template });
    }
    return json({ ...existing, template: existing.template ?? 'main' });
  }

  const serviceId = crypto.randomUUID();
  const svcTemplate = template ?? 'main';
  await env.DB.prepare(
    'INSERT INTO services (id, service_date, title, current_version, template) VALUES (?, ?, ?, 0, ?)'
  ).bind(serviceId, serviceDate, title, svcTemplate).run();

  return json({ id: serviceId, service_date: serviceDate, title, current_version: 0, template: svcTemplate }, 201);
});

// GET /api/services — List all services
route('GET', '/api/services', async (_request, env) => {
  const { results } = await env.DB.prepare(
    `SELECT s.id, s.service_date, s.title, s.current_version, s.template, s.created_at,
            v.checksum, v.song_count, v.published_at
     FROM services s
     LEFT JOIN versions v ON v.service_id = s.id AND v.version = s.current_version
     ORDER BY s.service_date DESC`
  ).all();

  return json({ services: results });
});

// DELETE /api/services/:id — Delete a service and all its data
route('DELETE', '/api/services/:id', async (_request, env, params) => {
  const service = await env.DB.prepare(
    'SELECT id, current_version FROM services WHERE id = ?'
  ).bind(params.id).first<{ id: string; current_version: number }>();

  if (!service) return errorResponse('Service not found', 404);

  // Delete all R2 objects for this service
  const prefix = `services/${params.id}/`;
  let cursor: string | undefined;
  do {
    const listed = await env.BUCKET.list({ prefix, cursor });
    if (listed.objects.length > 0) {
      await Promise.all(listed.objects.map(obj => env.BUCKET.delete(obj.key)));
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  // Delete from DB (songs → versions → services)
  await env.DB.batch([
    env.DB.prepare(
      'DELETE FROM songs WHERE version_id IN (SELECT id FROM versions WHERE service_id = ?)'
    ).bind(params.id),
    env.DB.prepare('DELETE FROM versions WHERE service_id = ?').bind(params.id),
    env.DB.prepare('DELETE FROM services WHERE id = ?').bind(params.id),
  ]);

  return json({ ok: true });
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
        'SELECT filename, title, slide_count, sort_order, template FROM songs WHERE version_id = ? ORDER BY sort_order'
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

// GET /api/calendar — Proxy ICS feed and return parsed events
route('GET', '/api/calendar', async (_request, env) => {
  if (!env.ICAL_URL) return errorResponse('ICAL_URL not configured', 500);

  const res = await fetch(env.ICAL_URL);
  if (!res.ok) return errorResponse('Failed to fetch calendar', 502);

  const ics = await res.text();
  const blocks = ics.split('BEGIN:VEVENT');
  blocks.shift(); // discard preamble

  const events: { date: string; title: string; time: string }[] = [];

  // Timely publishes UTC timestamps with no TZID; render in the church's zone
  const centralFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  for (const block of blocks) {
    const raw = block.split('END:VEVENT')[0];
    // Unfold ICS continuation lines (RFC 5545 §3.1)
    const unfolded = raw.replace(/\r?\n[ \t]/g, '');

    let dtstart = '';
    let summary = '';

    for (const line of unfolded.split(/\r?\n/)) {
      if (line.startsWith('DTSTART')) {
        dtstart = line.substring(line.indexOf(':') + 1);
      } else if (line.startsWith('SUMMARY')) {
        summary = line.substring(line.indexOf(':') + 1);
      }
      if (dtstart && summary) break;
    }

    if (!dtstart || !summary) continue;

    const toDate = (s: string) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    let date: string;
    let time: string;

    if (dtstart.length === 8) {
      date = toDate(dtstart);
      time = 'All day';
    } else if (dtstart.endsWith('Z')) {
      // UTC: YYYYMMDDTHHMMSSZ — convert, since midnight UTC can be the prior local day
      const utc = new Date(Date.UTC(
        +dtstart.slice(0, 4),
        +dtstart.slice(4, 6) - 1,
        +dtstart.slice(6, 8),
        +dtstart.slice(9, 11),
        +dtstart.slice(11, 13),
      ));
      const parts = Object.fromEntries(
        centralFmt.formatToParts(utc).map((p) => [p.type, p.value]),
      );
      date = `${parts.year}-${parts.month}-${parts.day}`;
      time = `${parts.hour}:${parts.minute} ${parts.dayPeriod}`;
    } else {
      // Local/floating: YYYYMMDDTHHMMSS
      date = toDate(dtstart);
      const hh = parseInt(dtstart.slice(9, 11), 10);
      const mm = dtstart.slice(11, 13);
      const ampm = hh >= 12 ? 'PM' : 'AM';
      const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
      time = `${h12}:${mm} ${ampm}`;
    }

    events.push({ date, title: summary, time });
  }

  events.sort((a, b) => a.date.localeCompare(b.date));
  return json({ events });
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
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
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
