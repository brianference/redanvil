PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE jobs (id TEXT PRIMARY KEY, slug TEXT NOT NULL, prompt TEXT NOT NULL, target_type TEXT NOT NULL, threshold INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'queued', created_at TEXT NOT NULL);
INSERT INTO "jobs" ("id","slug","prompt","target_type","threshold","status","created_at") VALUES('89364ba8-7ca5-401d-bc29-f488d7caab81','build-a-habit-tracker-with-streaks','Build a habit tracker with streaks','fullstack-web',90,'queued','2026-07-21T19:51:15.444Z');
CREATE TABLE prds (id TEXT PRIMARY KEY, slug TEXT NOT NULL, title TEXT NOT NULL, prompt TEXT NOT NULL, markdown TEXT NOT NULL, created_at TEXT NOT NULL);
INSERT INTO "prds" ("id","slug","title","prompt","markdown","created_at") VALUES('7db1d6aa-e290-46ba-a99b-f344538bc22a','demo-prd','Demo PRD','Build a demo app for testing',replace('# Demo PRD\n\nThis is a saved PRD with enough content to pass validation.','\n',char(10)),'2026-07-22T03:31:47.071Z');
