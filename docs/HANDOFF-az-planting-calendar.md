# Handoff — AZ Planting Calendar

Read `docs/DONE-CHECKLIST.md` first. Nothing below may be called done until its
rows are measured and the evidence artifact opened.

## Where it lives

- App: `az-planting-calendar/` — a workspace in this repo (with `orchestrator`,
  `app-builder`, `dashboard`). Pushed to `brianference/redanvil`.
- Production: **https://az-planting-calendar.pages.dev**
- D1: database `az-planting-calendar`, id `41ca2104-5893-48f0-a78f-42546380f9e1`,
  migrations applied remotely.

## Verified true (artifact opened, this session)

- **Backend is real, not a dummy UI.** Live probes returned: `/api/health` 200,
  `/api/crops` 200 (6 KB), `/api/plantable` 200 (computes half-month 14 = "Aug 1"
  from the date), `/api/grid` 200 (**40 KB**), `/api/zone` 200,
  `/api/crops/crop-tomatoes` 200, `/api/crops/nope` **404**.
- **Data comes from D1**, not literals: `functions/lib/db.ts` has 8 `.prepare()`
  calls; remote query returned **45 crops, 83 planting windows**.
- **No third-party API.** Zero outbound `fetch()` in `functions/` except the SPA
  fallback in `_middleware.ts`.
- **Crop data traces to source.** 45 of 53 rows matched the az1005 PDF text
  character-for-character; the other **8 were dropped**, each with its reason
  recorded in `scripts/az1005-crops.json`.
- **Logo chosen:** `design-refs/logos/v2/01-calendar-behind-edit.jpg`. See
  `design-refs/logos/DECISION.md` — good full size, **fails at 32px**.

## Known broken (measured, not fixed)

| Defect | Evidence |
|---|---|
| Light theme hero stays **black** in light mode | screenshot at 1280 light, viewed |
| Theme control is a text button "THEME/System", not discoverable | same screenshot |
| `/about`, `/contact`, `/terms`, `/privacy` all render the **home page** | `design_audit`: 81 words, identical titles |
| Legal pages are stubs (need ≥1200 words, ≥8 sections) | same |
| Pages render ~20% wide on desktop (need ≥80% painted) | user-reported; `desktop_width` not yet run on this app |
| Header not sticky; body text 12px (floor 16); skip-link <44px | `design_audit` |
| **Search does not work** — `?q=tomato` returns all 45 crops | live probe |
| **No assistant** — `/api/assistant` returns 405 | live probe |
| Brand mark is the literal text `AZ` | `Layout.tsx:26-28` |
| `SOURCES.md`, `INTEGRATIONS.md`, `COMPETITORS.md` absent | `ls` |
| `/api/zone` and `/api/crops/[id]` have **no tests** | file inventory |
| App has **never been scored** — no gate run, no verdicts | no `results/` entry |

## Traps that already cost time here

1. **Wrong app on the port.** Two stale `wrangler pages dev` processes hold 8791
   and survive `pkill`. A fresh server on 8799 served **QuickFlight** while cwd
   was `az-planting-calendar` and `dist/index.html` was correct on disk. A full
   12-rule audit came back authoritative and about the wrong product.
   **Always assert the served `<title>` matches the app before trusting a number.**
2. **`fe-search-present` gives a false pass** on this app — it detects the
   Method/Month `<select>` filters and calls that search. A rewrite to prove
   *narrowing* is in flight.
3. **Deriving the favicon by downscaling** the chosen logo produces an
   unreadable smudge. It needs a separate simplified mark.
4. **MSYS path conversion** mangles `--routes /about,...` in Git Bash. Prefix with
   `MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*'`.

## Next steps, in order

1. Kill every stale wrangler process; serve `az-planting-calendar/dist`; **assert
   the served title** contains "Planting" before measuring anything.
2. Re-run `design_audit` and `desktop_width` against that server. The five design
   fixes were delegated and their result is **unverified** — the only audit run
   after them measured the wrong app.
3. Build real Terms/Privacy (≥1200 words, ≥8 sections), fix the four routes, fix
   desktop width. Every legal claim must be true of this app: no accounts (no
   auth exists in `functions/`), no tracking cookies, 45 crops from az1005 with 8
   excluded, not affiliated with the University of Arizona, and Cave Creek sits
   ~2,200 ft against Phoenix's ~1,100 so county dates run early.
4. Implement search (server-side `?q=` + a text input that narrows) and an
   assistant endpoint grounded in the app's own D1.
5. Wire the chosen logo; build the separate 32px favicon; verify by opening both.
6. Add to `reverify.mjs` — already done — then measure, derive verdicts, gate to
   ≥90, confirm `lg-shipped`.

## Enforcement landed or in flight

- `lg-shipped` (blocker) — repo + pushed + URL 200 + served hash matches + gate
  meets the bar. Passes for app-builder and dashboard; **fails** this app.
- `fe-assistant-present` (blocker) — correctly fails this app.
- `fe-search-present` — **built but wrong**, gives a false pass; rewrite in flight.
- In flight: `proc-artifact-verified`, `fe-brand-mark`, `fe-prior-art`,
  `fe-light-dark` measuring computed paint per region, `isDone()`, pre-push hook,
  `apps-meet-the-bar` CI job, scheduled drift re-audit.
- Global rules added to `~/.claude/CLAUDE.md`: *a spec is not a deliverable*, and
  *always see the page, never infer it from source*.

## State of the other three apps

app-builder **95/100**, dashboard **96/100**, QuickFlight **92/100** — all green
in CI run #129, all independently reproduced, all deployed and hash-verified.
