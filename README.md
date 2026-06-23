# txt2pro

Turn plain‑text bilingual song lyrics into ProPresenter bundles for Sunday
services. Upload `.txt`/`.rtf` files (one song each, main language + translation),
preview and edit the slides in the browser, then publish a versioned bundle the
church computer syncs automatically.

## Layout

| Path        | What it is                                                            |
|-------------|-----------------------------------------------------------------------|
| `web/`      | Frontend SPA (Vite + React). Deployed to **Cloudflare Pages**.        |
| `worker/`   | API (Cloudflare Worker) + D1 database + R2 storage. Serves `/api/*`.  |
| `src/`      | Shared parser/proto code used by both (`@shared/*`).                  |
| `proto/`    | ProPresenter protobuf definitions (gitignored build output).         |

The frontend and API are **separate deployments**. The Worker does not serve the
web assets.

## Hosting (Cloudflare — "SFT Church" account)

> **Account:** everything lives on the Cloudflare account
> `59bcb20b29ce51fadf44b0b7c3ead225` ("SFT Church"), pinned in
> `worker/wrangler.jsonc`. You must be `wrangler login`'d to an account that has
> access to it — a personal account will fail with `Authentication error [10000]`
> / "account_id … does not match any of your authenticated accounts".

| Piece     | Name             | URL                                    |
|-----------|------------------|----------------------------------------|
| Frontend  | Pages `txt2pro`  | https://txt2pro.pages.dev              |
| API       | Worker `txt2pro` | https://txt2pro.sft-church.workers.dev |
| Database  | D1 `txt2pro`     | —                                      |
| Storage   | R2 `txt2pro`     | —                                      |

The Pages project is **direct‑upload** (not Git‑connected), so pushing to GitHub
does **not** deploy it — you deploy with Wrangler (below).

## Develop

```sh
# Frontend (http://localhost:5173, talks to the dev API via web/.env.development)
cd web && npm install && npm run dev

# API
cd worker && npm install && npm run dev
```

## Build & deploy

```sh
# 1. Frontend → Cloudflare Pages (production)
cd web
npm run build                                    # outputs web/dist (incl. public/ assets)
CLOUDFLARE_ACCOUNT_ID=59bcb20b29ce51fadf44b0b7c3ead225 \
  npx wrangler pages deploy dist --project-name=txt2pro

# 2. API → Cloudflare Worker (only when worker/ changed)
cd worker
npm run deploy                                   # wrangler deploy
```

Pages keeps deployment history, so a bad deploy can be rolled back from the
Cloudflare dashboard (Pages → txt2pro → Deployments).

**Verify a deploy** — the live bundle hash should match the local build:

```sh
curl -s https://txt2pro.pages.dev | grep -oE 'assets/index-[^"]+\.js'   # compare to web/dist/assets
```

## Notes

- `web/.env.production` points the frontend at the production Worker URL; do not
  change it unless the API URL changes.
- **Drafts** (in‑progress edits) are autosaved to the browser's `localStorage`
  per service — local to each device, cleared on publish.
- The Planning Center calendar feed token currently lives in `worker/wrangler.jsonc`
  as a plain `var` (the repo is private). To harden it, move it to a secret:
  `cd worker && npx wrangler secret put ICAL_URL` and drop it from `vars`.
