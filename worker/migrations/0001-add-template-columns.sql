-- Adds template support (per-service default + per-song override).
-- Apply to the production D1 database with:
--   cd worker && npx wrangler d1 execute txt2pro --remote --file=migrations/0001-add-template-columns.sql
ALTER TABLE services ADD COLUMN template TEXT NOT NULL DEFAULT 'main';
ALTER TABLE versions ADD COLUMN template TEXT;
ALTER TABLE songs ADD COLUMN template TEXT;
