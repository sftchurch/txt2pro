# txt2pro

## Changelog policy

Before every deploy to Cloudflare Pages (production) and every push to GitHub,
update `CHANGELOG.md` with the changes going out: add or extend the entry for
today's date, newest first. Preview-branch Pages deploys don't require an
entry, but the changes must be logged by the time they reach production or
GitHub.

## Deploy reference

- Web (Cloudflare Pages, project `txt2pro`):
  `cd web && npm run build`, then
  `npx wrangler pages deploy dist --project-name=txt2pro --branch=preview` for
  preview (https://preview.txt2pro.pages.dev) or `--branch=main` for
  production (https://txt2pro.pages.dev).
- Worker (API, `txt2pro` on workers.dev):
  `cd worker && npx wrangler deploy`.
- The preview frontend talks to the production worker and database — only the
  UI is forked. Drafts live in per-origin localStorage, so preview and
  production don't share unsaved edits.
