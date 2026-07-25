import type { DataStorage } from '../../job';
import { PRD_THRESHOLD, REQUIRED_PAGES } from '../types';
import { DEFAULT_DATA_STORAGE, storageLabel } from '../naming';

/**
 * Architecture subsection: concrete Cloudflare stack, request flow, layer bounds.
 */
export function buildArchitectureSection(opts: {
  hasAuth: boolean;
  dataStorage: DataStorage;
  hasRealtime: boolean;
  integrations: string;
}): string {
  const storageLine = storageLabel(opts.dataStorage);
  const realtimeLine = opts.hasRealtime
    ? 'Yes — design for live refresh (short polling or Server-Sent Events over Pages Functions; no long-lived Node WebSocket server). Document the chosen mechanism in the API contract before coding.'
    : 'No — request/response only; do not add sockets or live channels.';
  const integrationsLine =
    opts.integrations.trim().length > 0
      ? opts.integrations.trim()
      : 'None specified — do not invent third-party integrations.';
  const authLine = opts.hasAuth
    ? 'Web Crypto (PBKDF2 password hash + HMAC-SHA256 session cookies) in Pages Functions'
    : 'None (public routes; no session middleware)';

  return [
    'Concrete runtime for a coding agent that has **only this PRD**.',
    '',
    '### Stack',
    '',
    '| Layer | Choice |',
    '|-------|--------|',
    '| UI | Vite + React + TypeScript (strict) SPA on **Cloudflare Pages** |',
    '| API | **Cloudflare Pages Functions** (`functions/api/*`) |',
    `| Data | **Cloudflare D1** — ${storageLine} |`,
    `| Auth | ${authLine} |`,
    `| Realtime | ${realtimeLine} |`,
    `| Integrations | ${integrationsLine} |`,
    '',
    '### Request flow',
    '',
    '```',
    'Browser (SPA)',
    '   |  fetch /api/...',
    '   v',
    'Pages Function  -- Zod validate at boundary',
    '   |  parameterized SQL only',
    '   v',
    'D1 binding (env.DB)',
    '   |',
    '   v',
    'JSON Response + security headers (from shared http helper)',
    '```',
    '',
    '### Where concerns live',
    '',
    '- **Validation:** Zod schemas in `src/lib` / `functions` at every request boundary; fail closed (400) on invalid input.',
    '- **Error handling:** typed errors; never swallow exceptions; never render failure as an empty success.',
    '- **Security headers / CORS:** shared helper in `functions/lib/http.ts` (or equivalent) applied on every API response.',
    '- **Secrets:** Cloudflare secrets / `.env` only — never in source, client bundles, or logs.',
    '',
    '### Layer boundaries (hard)',
    '',
    '- No Node-only globals (`process`, `Buffer`) or native modules (`better-sqlite3`, `bcrypt`, `jsonwebtoken`) in Worker or browser code.',
    '- No Express or long-running Node server; no Supabase.',
    `- Data storage mode for this build: **${opts.dataStorage}** (default is \`${DEFAULT_DATA_STORAGE}\` when unspecified).`,
    opts.dataStorage === 'none'
      ? '- Storage is out of scope: do not add domain DDL beyond optional auth tables if auth is on.'
      : '- All domain tables and indexes are defined in `migrations/0001_init.sql` and match the Interface contract below.'
  ].join('\n');
}

/**
 * Design specifications as checkable requirements (premium shell + tokens).
 */
export function buildDesignSpecifications(): string {
  return [
    'These are **checkable** requirements for the UI system. A visual + axe review must pass at the listed viewports in both themes.',
    '',
    '#### Theme and tokens',
    '',
    '- [ ] Semantic theme tokens only (no raw hex/rgb/px for color/space in components). Tokens resolve per theme (light + dark).',
    '- [ ] Light and dark themes ship with a visible theme toggle; default follows system preference; choice may persist.',
    '- [ ] WCAG AA contrast: at least **4.5:1** for body text, **3:1** for large text and UI chrome. Measure with **axe-core**, not hand-parsed CSS.',
    '',
    '#### Type and spacing',
    '',
    '- [ ] Type scale from the design system (body floor **16px** / scale step that maps to 16px minimum for readable body copy).',
    '- [ ] Spacing scale from design tokens (consistent rhythm; no one-off magic numbers for layout gaps).',
    '- [ ] Minimum touch target **44×44px** for interactive controls (R1.1).',
    '- [ ] Safe-area insets respected on sticky bars and primary CTAs (`env(safe-area-inset-*)`).',
    '',
    '#### Premium shell (required pages)',
    '',
    `- [ ] Sticky top nav with brand mark, primary links, clear **hover** and **active** states (not bare text links).`,
    '- [ ] Breadcrumbs on inner/detail pages.',
    `- [ ] Required routes: **${REQUIRED_PAGES.join(', ')}** with unique title/description/OG per route.`,
    '- [ ] Professional multi-column footer; real brand mark (not emoji).',
    '- [ ] Loading, error, and empty states on every data screen; confirm before destructive actions.',
    '',
    '#### Responsive verification',
    '',
    '- [ ] No overlapping or clipped text at **375px**.',
    '- [ ] Verified at **375 / 768 / 1280** in **both** light and dark themes via real screenshots + axe (zero serious/critical).'
  ].join('\n');
}

/**
 * RedAnvil coding non-negotiables embedded for agents that only receive the PRD.
 */
export function buildCodingStandard(): string {
  return [
    'Echo of `rules/base-15.md` + `rules/per-app-pack.md`. Treat every line as a **must**.',
    '',
    '- [ ] **Strict TypeScript** — `strict` on; zero `any`; no untyped defs.',
    '- [ ] **Fail closed** — typed errors; unknown/partial state is an explicit error on screen and in APIs; never silent success.',
    '- [ ] **Parameterized D1 only** — no string-concatenated SQL.',
    '- [ ] **Zod at the boundary** — validate every request body/query; reject invalid input with 400.',
    '- [ ] **No Node-only globals/modules** in Worker or browser code (`process`, `Buffer`, `better-sqlite3`, `bcrypt`, `jsonwebtoken`).',
    '- [ ] **No secrets in code** — env / Cloudflare secrets only; never log secrets or PII.',
    '- [ ] **Real data only** — no filler copy, dummy rows, placeholder metrics, or fabricated scores.',
    '- [ ] **Smallest correct diff** — no speculative abstraction, no padding, no drive-by refactors.',
    '- [ ] **Single-purpose files** — small modules; pages compose named components.',
    '- [ ] **All user-facing copy** lives in the locale bundle (`src/i18n/en.ts`); no hardcoded UI strings.',
    '- [ ] **Theme tokens only** — colors/spacing/type from the design system; WCAG AA.',
    '- [ ] **Platform** — Cloudflare Pages + Pages Functions + D1; Web Crypto for auth when auth is in scope; no Express/Supabase.',
    '',
    '### Platform constraints checklist',
    '',
    '- **Platform:** Vite + React + TypeScript (strict) + Tailwind + React Router; Cloudflare Pages Functions + D1. No Express, no long-running Node server, no Supabase.',
    '- **Input safety:** parameterized SQL only; Zod validate every request body/query at the boundary.',
    '- **UX states:** every data screen defines loading, error, and empty; confirm before destructive actions.',
    '- **Fail closed:** typed errors; never log secrets or PII. Real data only — no fabricated metrics.'
  ].join('\n');
}

/**
 * Verification & gates section with exact commands.
 */
export function buildVerificationSection(slug: string): string {
  return [
    `**Target score:** >= **${PRD_THRESHOLD}** (see frontmatter \`threshold\`). Stop only when the RedAnvil gate reports score >= threshold with zero tier-1 blockers. Do not trust self-report.`,
    '',
    'Run from the **app directory** unless noted:',
    '',
    '1. `npx tsc --noEmit`',
    '2. `npx eslint . --max-warnings 0`',
    '3. `npx vitest run`',
    '4. `npm run build`',
    '5. Runtime health (after `npx wrangler pages dev ./dist` or equivalent local serve):',
    '   `curl -sf http://127.0.0.1:<port>/api/health` → JSON including `"status":"ok"`',
    '6. Playwright primary flow + axe (zero serious/critical violations)',
    '7. Visual review screenshots at 375 / 768 / 1280 (light + dark)',
    '',
    'From the **RedAnvil monorepo root** (see root `README.md` / `npm run gate`):',
    '',
    '```bash',
    `npm run gate -- ${slug} --threshold ${PRD_THRESHOLD}`,
    '```',
    '',
    'Optional excludes when a check is not applicable: `--na ci,process` (only with documented reason).'
  ].join('\n');
}
