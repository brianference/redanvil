# Root cause report — sushi-finder

Debugger pass over every row in `evidence/assignments.json`.
For each finding: investigation and reproduction first, then **root cause**, then proposed fix only.
No code fixes were applied in this pass.

---

## 1. Failed AI model call returns HTTP 200 with D1 grounding

**Finding:** BLOCKER — Failed AI model call is caught and still returns HTTP 200 with D1 grounding; JSDoc promises 502/503. Live model failure is reported as success (`functions/api/assistant.ts` ~186).

**Owning role:** engineer  
**Source:** `evidence/judge-diff.json`

### Reproduction

Static control-flow read of `functions/api/assistant.ts`:

1. JSDoc on `onRequestPost` (lines 142–145) states: “Failed model/binding calls return 502/503, never an empty 200.”
2. Missing binding is handled correctly: `if (!env.AI)` returns 502 (lines 152–154).
3. The actual model call sits in `try { await env.AI.run(...) }` (lines 165–172).
4. The matching `catch` (lines 186–190) is empty of any status return:

```ts
  } catch {
    // Workers AI may be unavailable in local dev (not logged in). Fall through to
    // D1-only grounding: match the user message against catalog titles. The
    // answer is still built exclusively from D1 rows — never invented places.
  }
```

5. Execution continues to `groundFilters` and `return json(..., 200)` (lines 192–206).

**What was reproduced:** the source path is deterministic — any throw from `env.AI.run` is swallowed and success is returned. A live Workers AI failure was not exercised against a remote binding in this session (no production host; see finding 14). The defect is fully established by the catch body and the 200 fall-through; it does not require a live model to prove the branch.

**What would fail the contract:** any thrown `AI.run` error must yield 502/503. The current code cannot do that after the catch.

### root cause

The failure path for `env.AI.run` was deliberately written as “degrade to D1-only and still 200” for local-dev convenience. That policy contradicts the public contract (JSDoc and acceptance intent for F9): a model failure is treated as success because the catch never rethrows and never calls `errorJson(..., 502)`. The missing-binding check only covers `!env.AI`; it does not cover a present binding that throws at runtime.

### Proposed fix

In the `catch` around `env.AI.run`, return `errorJson(request, 'Model or binding unavailable', 502)` (or 503 if preferred for transient provider errors). Do not fall through to a 200 grounded answer when the model call failed. If local-dev without AI is required, gate that behind an explicit env flag rather than silent success on every failure. Update JSDoc only if the contract intentionally changes (it should not).

---

## 2. F9 acceptance only mocks network-layer 502

**Finding:** Acceptance path F9 only mocks a network-layer 502 and never exercises the AI.run catch path that falsely succeeds — false contract stays green.

**Owning role:** testwriter  
**Source:** `evidence/judge-diff.json`

### Reproduction

Read `test/acceptance/assistant.test.ts` test “assistant shows error state on failed model call” (lines 66–100):

1. Playwright `page.route('**/api/assistant**')` fulfills POST with `status: 502` and a JSON body.
2. The browser never reaches the real `onRequestPost` handler.
3. Grep of the test file: no reference to `AI.run`, `groundFilters`, or a worker-level mock that makes `env.AI.run` throw while still invoking the real handler.
4. Therefore the green path only proves: “UI shows error when HTTP status is already 502.” It never proves: “handler returns 502 when the model throws.”

That is exactly why finding 1 can ship while F9 stays green.

### root cause

The acceptance test substitutes a fake HTTP response for the entire `/api/assistant` route. It validates client error UI against a pre-baked 502, not the server’s model-failure branch. There is no unit or acceptance test that invokes `onRequestPost` with a throwing `env.AI.run` mock, so the false-success contract is untested.

### Proposed fix

Add a unit (or Pages Functions) test that constructs `AppContext` with `env.AI = { run: async () => { throw new Error('model down'); } }` and a real/mocked D1, POST a valid message, and assert status **502** (or 503) and no success `answer` body. Keep the Playwright UI test, but optionally add a second server-level case so the catch path cannot silently 200. Until finding 1 is fixed, the new test should **fail** (that is the point).

---

## 3. Empty filters.q with no title match still returns full catalog

**Finding:** BLOCKER — Empty `filters.q` with no catalog title match still sets `items = full catalog` and answers “Found N sushi places…” for out-of-coverage questions (silent false success; `groundFilters` ~133).

**Owning role:** engineer  
**Source:** `evidence/judge-diff.json`

### Reproduction

Logic mirror of `groundFilters` (`functions/api/assistant.ts` lines 126–134), executed with Node:

```
catalog = [Sukiyabashi Jiro, Kura Sushi, Sugarfish]
userMessage = "What is the best sushi in Tokyo with live seating tonight?"
filters = {}
→ matched = [] (message does not include any catalog title)
→ items = all  (ternary: matched.length > 0 ? matched : all)
→ false success? true, count 3
```

Source line:

```ts
items = matched.length > 0 ? matched : all;
```

`buildAnswer` then produces “Found N sushi places…” for the full catalog (lines 99–108), which reads as a successful answer to an out-of-coverage question.

### root cause

When the model returns no `q` (or the AI catch leaves `filters = {}`) and the user message does not literally contain a catalog title, the fallback intentionally substitutes the **entire** catalog instead of an empty result set. That was written as a “list everything” default, but it converts unknown/out-of-coverage questions into false-positive “Found N…” answers. Combined with finding 1, model failure + empty filters almost always yields a 200 full-catalog dump.

### Proposed fix

Change the fallback so no title match ⇒ `items = []` (not `all`). Let `buildAnswer` already-written empty path emit the “No sushis… were found” message. Only use full-catalog listing when the user explicitly asks to list/browse the catalog (detect via message intent or a dedicated filter), not as the default for every empty `q`.

---

## 4. Desktop width: prose / coverage / lead max-width caps

**Finding:** BLOCKER — Desktop width: `.prose` / `.coverage-boundary` / `.lead` max-width caps starve legal and about text into a narrow left band at 1440/1920 instead of multi-column ≥80% viewport use (`src/theme.css` ~552, 507, 484, 394).

**Owning role:** layout  
**Source:** `evidence/judge-diff.json`

### Reproduction

Measured CSS caps in `src/theme.css`:

| Selector | Cap | Approx px (16px root, ~8px/ch) |
|----------|-----|--------------------------------|
| `.lead` | `max-width: 60ch` | ~480px |
| `.coverage-boundary` | `max-width: 48rem` | 768px |
| `.prose` (first block) | `max-width: 48rem` | 768px |
| `.prose` (second block, wins) | `max-width: 72ch` | ~576px |

`.shell__main` is `width: 100%` with only padding growth at 900/1280 — no multi-column layout for legal/about text.

Viewport share of the winning `.prose` (~576px):

| Viewport | ~% of viewport |
|----------|----------------|
| 1440px | ~40% |
| 1920px | ~30% |

Both fail a ≥80% multi-column content-use bar. Legal pages (`Privacy.tsx`, `Terms.tsx`) wrap body copy in `<article className="prose">`; About/Contact use `.prose` or `.lead` / `.coverage-boundary` the same way. Content stays a single narrow left column; footer grid is multi-column, but the long text is not.

**Browser screenshot at 1440/1920:** not captured in this debugger pass (no local server required for the CSS math; the max-width rules are absolute). Confidence on the width math is high; visual confirmation can be done by layout after fix.

### root cause

Reading-width caps (`ch` / `rem` max-width) were applied to the **page content containers** used for legal and about copy, without a desktop layout that expands into multi-column or ≥80% width. The shell is full width; the text blocks intentionally stay narrow for line length. That design choice conflicts with the gate’s desktop multi-column / width-utilization requirement for those pages.

### Proposed fix

For legal/about (and any page required to use desktop width): keep comfortable measure per column but put prose in a multi-column layout at large breakpoints (e.g. CSS `columns`, or a 2-column grid of sections, or full-width section cards spanning ≥80% of `.shell__main`). Raise or remove `max-width` on `.prose` / `.coverage-boundary` at `min-width: 1280px` when multi-column is active so the band is not a single left-aligned 72ch strip. Do not “fix” by only deleting max-width into an unreadably wide single column without multi-column structure.

---

## 5. catch blocks forward err.message into JSON 500 bodies

**Finding:** MAJOR — catch blocks forward `err.message` into JSON 500 bodies (`sushis.ts`, `sushis/[id].ts`, `assistant.ts`); D1/runtime detail leaks to anonymous clients.

**Owning role:** engineer  
**Source:** `evidence/judge-diff.json`

### Reproduction

Pattern present in:

- `functions/api/sushis.ts` lines 37–38, 63–64  
- `functions/api/sushis/[id].ts` lines 46–47, 91–92, 113–114  
- `functions/api/assistant.ts` lines 208–209 (`Failed to ground assistant answer: ${detail}` with `String(cause).slice(0, 200)`)

Example of what a client would receive:

```json
{"error":"D1_ERROR: no such table: sushis at offset 42"}
```

(Reproduced by applying the same ternary the handlers use to a sample `Error`.)

There is no server-side logger; the raw message is the only channel and it goes to the client. All sushi APIs are public (no auth).

### root cause

Error handlers map `err.message` (or `String(cause)`) directly into `errorJson` for status 500. That was written for debuggability and never replaced with a stable public message + internal log. Any D1/driver/stack fragment in the thrown error becomes anonymous-client JSON.

### Proposed fix

Return a fixed public string for 500s (e.g. `"Internal server error"`). Log the real error only if an operator log path exists (or `console.error` on the worker for now). Keep specific messages for intentional 4xx and for known 503 binding-missing cases. Apply the same rule to the assistant grounding catch.

---

## 6. User-facing chrome strings hardcoded outside en.ts

**Finding:** MAJOR — User-facing chrome strings hardcoded outside `src/i18n/en.ts`: Layout footer “Explore”/“Legal”, nav aria-label “Primary”, AssistantPanel grounding line, SushiDetailPage “Detail”, HomePage/SushiListPage aria-labels, HomePage KPI “D1”.

**Owning role:** content  
**Source:** `evidence/judge-diff.json`

### Reproduction

Grep / file reads confirmed:

| Location | Hardcoded string |
|----------|------------------|
| `Layout.tsx` | `aria-label="Primary"`, footer `<h2>Explore</h2>`, `<h2>Legal</h2>` |
| `AssistantPanel.tsx` | `` `${links.length} catalog match… used for grounding.` `` |
| `SushiDetailPage.tsx` | breadcrumb `{ label: 'Detail' }` |
| `HomePage.tsx` | `aria-label="Catalog metrics"`, KPI value `D1` |
| `SushiListPage.tsx` | `aria-label="List metrics"` |

`src/i18n/en.ts` header claims “No hardcoded product strings in components,” but these keys are missing from `en`.

### root cause

Several shell/chrome labels were typed inline when building Layout and page shells, while primary nav labels and most body copy went through `en`. There is no lint or convention enforcing “all UI strings via en,” so the split persisted. “D1” is also a product-facing KPI value with no i18n key.

### Proposed fix

Add keys under `en` (e.g. `footer.explore`, `footer.legal`, `nav.primary`, `assistant.groundingCount`, `detail.breadcrumb`, `home.kpiMetricsLabel`, `home.kpiPlacesValue`, `sushis.kpiMetricsLabel`) and replace every listed literal. Keep accessible names and visible chrome in the same catalog as the rest of the product copy.

---

## 7. Privacy and Terms body policy is inline JSX

**Finding:** MAJOR — Privacy and Terms body policy is inline JSX (`Privacy.tsx`, `Terms.tsx`); `en.ts` holds only title + updated date. Legal copy not centralizable as locale data.

**Owning role:** content  
**Source:** `evidence/judge-diff.json`

### Reproduction

- `en.privacy` / `en.terms` only export `title` and `updated`.
- `Privacy.tsx` and `Terms.tsx` contain multi-section legal prose as JSX `<p>` / `<h2>` children (dozens of paragraphs of English hard-coded in the component files).

### root cause

Legal pages were written as long-form React components for structure (headings, lists) while only the page chrome (title, “last updated”) was placed in `en.ts`. That leaves legal body copy outside the i18n module the project claims is the single source of user-facing strings.

### Proposed fix

Move section titles and body paragraphs into `en.privacy` / `en.terms` (structured arrays of `{ heading, paragraphs }` or markdown/HTML strings), and render from data in the page components. Preserve measured word-count floors when moving copy. Do not leave only title/date in locale data.

---

## 8. Missing SEO pack (robots, sitemap, per-route meta)

**Finding:** MAJOR — Missing SEO pack: no `robots.txt`, no `sitemap.xml` under `public/` or `dist/`; client routes never set per-route title/description/OG (only `index.html`).

**Owning role:** engineer  
**Source:** `evidence/judge-diff.json`

### Reproduction

- `public/` contains only `_headers`, `favicon-32.png`, `logo.png`.
- `dist/` after build mirrors that (no robots/sitemap).
- Grep of `src/` for `document.title`, Helmet, or meta updates: **no matches**.
- SPA routes (`/`, `/sushis`, `/about`, `/terms`, `/privacy`, `/contact`, detail, forms) all share the single static title/description from `index.html`.

### root cause

SEO was only addressed at the static HTML shell (`index.html` meta + JSON-LD). No build-time or runtime step generates `robots.txt` / `sitemap.xml`, and no route-level effect sets `document.title` or meta tags after client navigation. The gap is omission, not a broken generator.

### Proposed fix

Add `public/robots.txt` and `public/sitemap.xml` (or generate sitemap at build) listing the public routes and canonical host. Add a small route meta helper (or react-helmet-async equivalent) so each page sets title + description + OG on mount. Align sitemap/canonical host with the real production URL once deployed.

---

## 9. False product claim in index.html meta description

**Finding:** MAJOR — False product claim: `index.html` meta description sells discovery “by style, price band, and walk-in policy” but schema/UI only support title + free-text description and title search. Homepage meta sells unimplemented capabilities.

**Owning role:** product  
**Source:** `evidence/judge-diff.json`

### Reproduction

`index.html` lines 7–9:

> Discover sushi restaurants by style, price band, and walk-in policy…

Actual product surface:

- `SushiRowSchema` / D1: `id`, `title`, `description`, timestamps only (`src/lib/schemas.ts`, migrations).
- Search: title fragment via `listSushis` LIKE on `title` (`functions/lib/db.ts`).
- UI: search label “Search sushis by title”; About copy already admits no style/price/walk-in columns (`en.about.coverageBody`).
- Seed descriptions may *mention* style or price in prose, but there are no filter fields or facets for them.

OG description is more honest (“search by title”); the primary meta description is not.

### root cause

Marketing copy in the static meta description was written for a broader “finder” story (style / price / walk-in) that was never modeled in schema or UI. Product truth is title + free-text description + title search; the meta string was not updated when the MVP scope settled.

### Proposed fix

Rewrite the primary meta description (and any matching marketing lines) to match shipped capabilities: public catalog, search by title, detail, manage, D1-grounded assistant. Do not claim style/price/walk-in filters unless columns and UI are implemented. Product owns the wording; engineer applies it in `index.html` / route meta.

---

## 10. Ad-hoc inline style objects for layout chrome

**Finding:** MINOR — Ad-hoc inline style objects for layout chrome (Layout footer, SushiListPage, SushiDetailPage) instead of CSS classes on theme tokens.

**Owning role:** engineer  
**Source:** `evidence/judge-diff.json`

### Reproduction

Confirmed inline styles:

- `Layout.tsx`: `style={{ color: 'var(--color-muted)', marginTop: '1rem' }}` (footer paragraphs)
- `SushiListPage.tsx`: `style={{ marginBottom: 'var(--space-4)' }}` on toolbar
- `SushiDetailPage.tsx`: `style={{ fontSize: 'var(--text-sm)', textTransform: 'uppercase' }}` on description heading

Theme already defines tokens and class patterns (`.prose__updated`, utility spacing). These spots bypass classes.

### root cause

One-off layout tweaks were applied with React `style={{}}` instead of extending `theme.css`. Tokens are used as values, so theming still works, but the project’s “semantic tokens only in components” / class-based chrome pattern is inconsistent.

### Proposed fix

Add small utility or component classes in `theme.css` (e.g. `.footer-blurb`, `.toolbar--spaced`, `.detail-label`) and replace the inline objects. No behavior change.

---

## 11. Search LIKE binds `%${trimmed}%` without escaping metacharacters

**Finding:** MINOR — Search LIKE binds `%${trimmed}%` without escaping LIKE metacharacters `%` and `_` (`functions/lib/db.ts` ~48); parameterized but widens matches beyond literal title fragments.

**Owning role:** engineer  
**Source:** `evidence/judge-diff.json`

### Reproduction

```ts
const like = `%${trimmed.toLowerCase()}%`;
// user input "%fish" → pattern "%%fish%"  (extra wildcard)
// user input "su_i"  → pattern "%su_i%"   (_ matches any single character)
```

Confirmed with Node: `likePattern('%fish')` → `"%%fish%"`, `likePattern('su_i')` → `"%su_i%"`.  
SQL is parameterized (no injection of SQL structure), but LIKE semantics treat user `%` / `_` as wildcards, so results are wider than a literal substring search.

### root cause

The bound pattern wraps the raw trimmed query in `%…%` without escaping LIKE special characters. Parameterization prevents injection; it does not neutralize LIKE metacharacters inside the pattern string.

### Proposed fix

Escape `%` and `_` (and `\` if using ESCAPE) in the user fragment before wrapping, e.g. replace `\` → `\\`, `%` → `\%`, `_` → `\_`, and use `LIKE ? ESCAPE '\'` in SQLite. Keep parameterization.

---

## 12. ThemeToggle only shows Unicode moon glyph

**Finding:** MINOR — ThemeToggle renders only a Unicode moon glyph; `en.theme.light` / `dark` / `system` exist but are unused as visible text; sighted users get no mode cue (`ThemeToggle.tsx`).

**Owning role:** engineer  
**Source:** `evidence/judge-diff.json`

### Reproduction

`ThemeToggle.tsx` button children:

```tsx
{resolved === 'dark' ? '◐' : '◑'}
```

- `aria-label` / `title` use `en.theme.toggle` and mode name (screen-reader / tooltip only).
- `en.theme.light`, `en.theme.dark`, `en.theme.system` are defined in `en.ts` and never rendered as visible text.
- Sighted users see only a glyph with no “Light” / “Dark” / “System” label.

### root cause

The control was implemented as an icon-only cycle button. Locale strings for the three modes were added to `en.ts` but never wired into the button’s visible content (only into `title` partially via raw `mode` string).

### Proposed fix

Render visible mode text from `en.theme[mode]` (or show next-mode label) next to or instead of relying solely on the glyph. Keep `aria-label` for accessibility. Optionally show both glyph + text at `min-width` breakpoints.

---

## 13. en.contact.email is contact@example.invalid

**Finding:** MINOR — `en.contact.email` is `contact@example.invalid` presented as project contact; dead contact surface (prefer no email line or a real contact).

**Owning role:** content  
**Source:** `evidence/judge-diff.json`

### Reproduction

- `src/i18n/en.ts`: `email: 'contact@example.invalid'`
- `ContactPage.tsx` renders: `{en.contact.emailLabel}: {en.contact.email}`

`.invalid` is a reserved TLD for documentation; the address is intentionally non-deliverable. Users are shown a “Project contact” email that cannot receive mail.

### root cause

A placeholder address was used to satisfy “show a contact email” without a real mailbox. The Contact page still presents it as a live project contact line.

### Proposed fix

Either remove the email line and keep repository/issue guidance only (`en.contact.body` already points at the repo), or replace with a real monitored address. Do not leave `example.invalid` as a presented contact.

---

## 14. Production host NXDOMAIN (user refuse)

**Finding:** User refuse: production host `https://sushi-finder.pages.dev/` is NXDOMAIN — site not on the public internet; catalog, search, detail, and assistant never load for a first-time visitor with only the advertised URL.

**Owning role:** engineer  
**Source:** `evidence/user-refuse.json`

### Reproduction (this session)

```
nslookup sushi-finder.pages.dev
→ Non-existent domain

Invoke-WebRequest https://sushi-finder.pages.dev/
→ The remote name could not be resolved: 'sushi-finder.pages.dev'
```

Matches `evidence/user-refuse.json` (`verdict: refuse`).

Additional project state:

- Workspace has **no `.git`** directory (no origin remote to push from this tree as inspected).
- `wrangler.toml` uses `database_id = "local-sushi-finder-db"` (local placeholder, not a real Cloudflare D1 UUID).
- Local `.wrangler/state` exists (local D1 only).
- Canonical URL in `index.html` still advertises `https://sushi-finder.pages.dev/`.

### root cause

The advertised production hostname does not exist in public DNS because the app has not been successfully created/deployed as a Cloudflare Pages project that owns `sushi-finder.pages.dev` (or DNS was never published for that project). Local build and wrangler state do not create a public Pages hostname. The product therefore cannot load for anyone using only the advertised URL.

### Proposed fix

1. Create/ensure Cloudflare Pages project `sushi-finder` and a real D1 database; put the real `database_id` in `wrangler.toml`.  
2. Apply migrations to remote D1; deploy `dist` + Functions (`wrangler pages deploy` or git-connected deploy).  
3. Confirm DNS resolves and `GET /` returns 200; confirm asset hash matches local `dist/`.  
4. Push the app to a GitHub origin if shipping rules require a remote.  
5. Re-run user-refuse against the live URL.

---

## 15. /api/health on production also fails NXDOMAIN

**Finding:** User refuse: `/api/health` on the same origin also fails for NXDOMAIN — no backend surface from a visitor’s point of view.

**Owning role:** qa-runtime  
**Source:** `evidence/user-refuse.json`

### Reproduction (this session)

```
Invoke-WebRequest https://sushi-finder.pages.dev/api/health
→ The remote name could not be resolved: 'sushi-finder.pages.dev'
```

Same DNS failure as finding 14. HTTP never starts; the health handler in `functions/api/health.ts` is irrelevant until DNS exists.

### root cause

Not a bug in the health handler. Backend and frontend share the Pages origin; when the host is NXDOMAIN, `/api/health` fails for the same reason as `/`. There is no separate API hostname to probe.

### Proposed fix

Same as finding 14: deploy the Pages project so the origin exists. After deploy, qa-runtime should probe `https://<prod>/api/health` and require `{"status":"ok"}` with HTTP 200. Local unit test already covers the handler shape (`functions/api/health.test.ts`); the gap is production reachability only.

---

## 16. Logo decision axis still OPEN

**Finding:** Logo decision axis still OPEN — candidates mark-01..06 exist but no CHOSEN winner; decide role cannot close (`design-refs/logos/DECISION.md`).

**Owning role:** product  
**Source:** `evidence/decisions.json`

### Reproduction

`design-refs/logos/DECISION.md` status line: **OPEN** — “Left open for the product owner.” Six candidates exist; no CHOSEN / DECIDED token. Live app uses `public/logo.png` without a decision record naming which mark it is.

### root cause

Design candidates were produced and reviewed, but the product owner never recorded a winner. This is process state, not a runtime defect. The decide role has nothing to close until product writes CHOSEN.

### Proposed fix

Product opens `design-refs/logos/gallery.html`, picks one mark (or mix), writes **CHOSEN: mark-0N.png** (or equivalent) into `DECISION.md`, and ensures `public/logo.png` / favicon match that file. No engineering root-cause beyond “decision not made.”

---

## 17. Palette decision axis still OPEN

**Finding:** Palette decision axis still OPEN — palette-01..05 exist and axe-pass but no CHOSEN winner (`design-refs/palettes/DECISION.md`).

**Owning role:** product  
**Source:** `evidence/decisions.json`

### Reproduction

`design-refs/palettes/DECISION.md` status: **OPEN**. All five pass axe-core (documented in that file). Live `theme.css` comment notes “Ink Line palette direction (design-refs/palettes palette-02 — OPEN decision; closest match to binding visual)” — implementation assumed palette-02 without a CHOSEN record.

### root cause

Same class as logo: candidates + a11y evidence exist; product never wrote CHOSEN. Code drifted to an unofficial default (palette-02) while the decision file remains OPEN.

### Proposed fix

Product names a winner (or mix) in `DECISION.md` as **CHOSEN**. Engineer then aligns `theme.css` tokens to that choice if they differ from the interim palette-02.

---

## 18. Layout decision axis still OPEN

**Finding:** Layout decision axis still OPEN — options A/B/C exist but no DECIDED winner; fold owner / result unit not chosen (`design-refs/design-options/DECISION.md`).

**Owning role:** product  
**Source:** `evidence/decisions.json`

### Reproduction

`design-refs/design-options/DECISION.md` status: **OPEN**. Options A (photos grid), B (map canvas), C (seating board) are documented. Shipped app is a catalog list/detail SPA, not a recorded DECIDED fold owner from A/B/C.

### root cause

Layout options were prepared for a product pick that never closed. The implemented shell is a list/board hybrid without a DECIDED token, so the design decision axis remains OPEN by process definition.

### Proposed fix

Product writes **DECIDED: option-X** (or a documented mix) including fold owner and result unit. Engineer adjusts UI structure only if the DECIDED option differs from what shipped.

---

## 19. Dead link: http://127.0.0.1: from PRD placeholders

**Finding:** Dead link in link-check: `http://127.0.0.1:` (status 0) — scraped from PRD verify lines using placeholder `http://127.0.0.1:<port>/api/health`; published docs emit an unresolvable URL.

**Owning role:** content  
**Source:** `evidence/link-check.json`

### Reproduction

- `evidence/link-check.json`: `"url": "http://127.0.0.1:"`, `status: 0`, `ok: false`.
- `docs/PRD.md` lines 623 and 717 contain the literal placeholder:
  - `curl -sf http://127.0.0.1:<port>/api/health`
- A naive URL scraper treats `http://127.0.0.1:` as a URL and drops `<port>`, yielding an unresolvable host:port form.

### root cause

PRD verify instructions use angle-bracket placeholders inside a URL-shaped string. Link checking extracts them as real links. The documentation intent is “substitute your local port”; the published form is not a fetchable URL.

### Proposed fix

Rewrite verify lines so scrapers do not see a bare `http://127.0.0.1:` URL — e.g. use a concrete local example `http://127.0.0.1:8788/api/health` (matching `package.json` preview port) and note “or your wrangler port,” or write the host and path without a colon-before-placeholder pattern (`http://127.0.0.1` + `PORT` as separate tokens). Re-run link-check and confirm zero dead results.

---

## Cross-links (related defects)

| Cluster | Findings | Shared mechanism |
|---------|----------|------------------|
| Assistant false success | 1, 2, 3 | Empty AI catch + full-catalog fallback + tests that never hit the real failure path |
| Unreachable product | 14, 15 | No public Pages DNS / deploy |
| Open design axes | 16, 17, 18 | Candidates without CHOSEN/DECIDED |
| Copy / i18n integrity | 6, 7, 9, 13 | Strings and claims outside the true product contract |

---

## Method notes

- Code paths for API defects were read line-by-line; groundFilters and error-leak behavior were re-executed with Node mirrors of the same conditionals.
- Production NXDOMAIN was re-checked with `nslookup` and HTTP from this machine on 2026-08-07 (user_info date context).
- Desktop width used CSS max-width arithmetic vs 1440/1920; full Playwright screenshots of legal pages at those widths were not captured in this pass (stated above under finding 4).
- No finding was marked fixed. Proposed fixes are guidance for the owning roles only.
- If a live AI.run throw on a bound Workers AI account is required for additional proof of finding 1, re-test after deploy with a forced model error; source-level proof already shows the catch cannot return 502.
