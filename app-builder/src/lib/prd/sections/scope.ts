import type { FeatureSpec } from '../types';
import { PRD_THRESHOLD } from '../types';
import { entityPascal } from '../naming';

/**
 * Build non-goals bullets from platform defaults and wizard answers.
 */
export function buildNonGoals(
  hasAuth: boolean,
  entities: string[],
  appType: string,
  integrations: string
): string {
  const entityScope =
    entities.length > 0 ? entities.map((e) => entityPascal(e)).join(', ') : 'Item (default)';
  const namedIntegrations = integrations.trim();
  const paymentsLine =
    namedIntegrations.length > 0
      ? `- Do not invent integrations beyond those named in the wizard/Architecture (**${namedIntegrations}**). Secrets for them stay in env / Cloudflare secrets only — never in the repo.`
      : '- No payment processing, billing, or third-party integrations unless the mission names them (no Stripe, no vault, no secret files in the repo).';
  const lines = [
    `- Do not invent domain entities beyond the frontmatter list: **${entityScope}**.`,
    hasAuth
      ? '- Auth is in scope (Web Crypto only). Do not add OAuth, social login, or third-party IdPs unless the mission states them.'
      : '- **No authentication** — every route is public; do not add register/login, sessions, or user-owned scoping.',
    paymentsLine,
    '- No deploy automation inside the app itself (no CI push-to-prod buttons, no wrangler deploy from client code).',
    '- **Single-tenant** — no multi-org, team workspaces, or tenant isolation layers.',
    '- No Supabase, Express, bcrypt, or jsonwebtoken (Workers-incompatible).',
    '- No Node-only globals (`process`, `Buffer`) or native modules (`better-sqlite3`) in Worker/browser code.',
    appType.toLowerCase().includes('mobile')
      ? '- Mobile app type: ship a mobile-first responsive web UI; do not build a native iOS/Android shell unless explicitly required later.'
      : '- No native mobile shell — full-stack web (Cloudflare Pages) only.'
  ];
  return lines.join('\n');
}

/**
 * User stories derived from features and the product framing.
 */
export function buildUserStories(
  prompt: string,
  appType: string,
  features: FeatureSpec[],
  hasAuth: boolean
): string {
  const role = hasAuth ? 'registered user' : 'pet owner or end user';
  const appRole = appType.toLowerCase().includes('mobile') ? 'mobile user' : role;
  const stories = features
    .filter((f) => f.mvp)
    .map((f) => {
      const capability = f.name.charAt(0).toLowerCase() + f.name.slice(1);
      return `- As a **${appRole}**, I want **${capability}**, so that **${f.behavior.replace(/\.$/, '')}**.`;
    });
  stories.push(
    `- As a **builder**, I want **a vertical-slice build plan with verify commands**, so that **${prompt.trim().slice(0, 80)}${prompt.trim().length > 80 ? '…' : ''}** can be shipped with continuous end-to-end feedback.`
  );
  return stories.join('\n');
}

/**
 * Success outcome bullets — observable definition of done.
 */
export function buildSuccessOutcome(title: string, features: FeatureSpec[], slug: string): string {
  const mvp = features.filter((f) => f.mvp);
  const lines = [
    `- A user can complete the MVP flows (${mvp.map((f) => f.id).join(', ')}) without auth walls unless auth is in scope.`,
    `- Every MVP acceptance bullet under §9 is exercised by a named test in §10 and is green.`,
    `- \`GET /api/health\` returns JSON including \`"status":"ok"\` on a local Pages Functions serve.`,
    `- \`npx tsc --noEmit\`, \`npx eslint . --max-warnings 0\`, \`npx vitest run\`, and \`npm run build\` all exit 0.`,
    `- From monorepo root, \`npm run gate -- ${slug} --threshold ${PRD_THRESHOLD}\` reports score >= **${PRD_THRESHOLD}** with zero tier-1 blockers.`,
    `- No incomplete stub copy remains in the product UI; all user-facing strings live in \`src/i18n/en.ts\`.`,
    `- The product named **${title}** solves the problem stated in §2 for the MVP feature set alone.`
  ];
  return lines.join('\n');
}
