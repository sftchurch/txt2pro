# Operations — Solid Foundation Texas instance

Deployment and maintenance notes for the church's own txt2pro instance. If you
found this repo and want to run your own copy, see
[the README](../README.md#3-run-the-web-app-self-host-on-cloudflare) instead.

## Where things live

Everything is on the Cloudflare account **"SFT Church"**
(`59bcb20b29ce51fadf44b0b7c3ead225`, pinned in `worker/wrangler.jsonc`). You
must be `wrangler login`'d to an account with access to it — a personal account
fails with `Authentication error [10000]` / "account_id … does not match any of
your authenticated accounts".

| Piece     | Name             | URL                                    |
|-----------|------------------|----------------------------------------|
| Frontend  | Pages `txt2pro`  | https://txt2pro.pages.dev (production) · https://preview.txt2pro.pages.dev (preview branch) |
| API       | Worker `txt2pro` | https://txt2pro.sft-church.workers.dev |
| Database  | D1 `txt2pro`     | —                                      |
| Storage   | R2 `txt2pro`     | —                                      |
| Sync      | LaunchAgent `com.sftchurch.txt2pro-sync` on the ProPresenter Mac (`propresenter.sft`) | — |

The Pages project is **direct-upload** (not Git-connected): pushing to GitHub
does **not** deploy anything. The preview branch shares the production Worker
and database — only the UI is forked. Drafts live in per-origin
`localStorage`, so preview and production don't share unsaved edits.

## Deploy

Update `CHANGELOG.md` first (see `CLAUDE.md`), then:

```sh
# Frontend → Cloudflare Pages
cd web
npm run build                                   # outputs web/dist (incl. public/ assets)
npx wrangler pages deploy dist --project-name=txt2pro --branch=preview   # preview
npx wrangler pages deploy dist --project-name=txt2pro --branch=main      # production

# API → Cloudflare Worker (only when worker/ changed)
cd worker
npm run deploy
```

If wrangler picks the wrong account, prefix with
`CLOUDFLARE_ACCOUNT_ID=59bcb20b29ce51fadf44b0b7c3ead225`.

**Verify** — the live bundle hash should match the local build:

```sh
curl -s https://txt2pro.pages.dev | grep -oE 'assets/index-[^"]+\.js'   # compare to web/dist/assets
```

**Roll back** — Pages keeps deployment history: Cloudflare dashboard → Pages →
txt2pro → Deployments → Rollback. Workers: `npx wrangler rollback`.

## Database migrations

`worker/schema.sql` is the full schema for a fresh database. Changes to an
existing database go in `worker/migrations/NNNN-*.sql` and are applied by hand:

```sh
cd worker
npx wrangler d1 execute txt2pro --remote --file=migrations/0001-add-template-columns.sql
```

## Calendar feed

`ICAL_URL` in `worker/wrangler.jsonc` points at the public Timely Church ICS
feed (`https://app.timelychurch.com/c/solid-foundation-texas/calendar.ics`).
Timely publishes UTC timestamps; the Worker converts to America/Chicago.

If the feed is ever switched to one that embeds a private token (Planning
Center feeds do), store it as a secret, not a `var`:

```sh
cd worker && npx wrangler secret put ICAL_URL   # then delete it from vars
```

## Sync agent on the ProPresenter Mac

Installed from `sync/` via `./install.sh`; polls every 60 s while logged in and
at every login. Logs: `~/Library/Logs/txt2pro-sync.log`. State (delete to force
a full re-download): `~/Library/Application Support/txt2pro-sync/state.json`.
Menu-bar status comes from the SwiftBar plugin `sync/txt2prosync.30s.py`.
Details in [`sync/README.md`](../sync/README.md).

## Notes

- `web/.env.production` points the frontend at the production Worker URL; do
  not change it unless the API URL changes.
- Drafts (in-progress edits) autosave to the browser's `localStorage` per
  service — local to each device, cleared on publish.
