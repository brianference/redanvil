import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import type { Job } from '../schemas/job';

/**
 * Whether this job asked for accounts.
 *
 * Answers are strings (`JobSchema` is `z.record(z.string(), z.string())`).
 * The legal copy uses the same comparison, so the kit and the privacy
 * page cannot disagree about whether the app has sign-in.
 *
 * @param job - Validated scaffold job.
 * @returns True only when `answers.hasAuth` is the string `"true"`.
 */
export function jobHasAuth(job: Job): boolean {
  return job.answers?.hasAuth === 'true';
}

/**
 * Session cookie name for one app.
 *
 * `port.mjs` rejects anything that is not `^[a-z0-9_]+_session$`. A shared
 * name under `*.pages.dev` would let one app receive another's session.
 *
 * @param slug - Job slug (`demo-app`).
 * @returns Cookie name (`demo_app_session`).
 */
export function sessionCookieName(slug: string): string {
  const base = slug.replace(/-/g, '_').replace(/[^a-z0-9_]/g, '');
  return `${base.length > 0 ? base : 'app'}_session`;
}

/** Colour fields `port.mjs` writes into `appconfig.ts`. */
interface TokenColors {
  accent: string;
  text: string;
  muted: string;
}

/**
 * Read the brand colours the scaffold just wrote.
 *
 * The kit's defaults (`#c45c26` and friends) are a different product's
 * palette. The app's own token file is the source of truth.
 *
 * @param outDir - Scaffold output directory.
 * @returns Accent, text, and muted hex from `design-system/tokens.json`.
 */
async function readTokenColors(outDir: string): Promise<TokenColors> {
  const raw = await readFile(join(outDir, 'design-system', 'tokens.json'), 'utf8');
  const parsed = JSON.parse(raw) as { color?: Partial<TokenColors> };
  const color = parsed.color ?? {};
  if (!color.accent || !color.text || !color.muted) {
    throw new Error('design-system/tokens.json is missing color.accent, color.text, or color.muted');
  }
  return { accent: color.accent, text: color.text, muted: color.muted };
}

/**
 * Copy the auth kit into an app by running `design-system/auth-kit/port.mjs`.
 *
 * The kit's README says the port is mechanical and must not be re-implemented.
 * This spawns that script. It does not copy files itself. Call it only when
 * `jobHasAuth` is true, and only after the app directory and `package.json`
 * exist — the script refuses a missing directory and only warns when `zod`
 * is absent.
 *
 * @param opts - App directory, job, and absolute path to `port.mjs`.
 * @returns The script's stdout (the copy log).
 * @throws {Error} When `port.mjs` exits non-zero.
 */
export async function applyAuthKit(opts: {
  job: Job;
  outDir: string;
  portScript: string;
}): Promise<string> {
  const colors = await readTokenColors(opts.outDir);
  const args = [
    opts.portScript,
    '--app',
    opts.outDir,
    '--name',
    opts.job.slug,
    '--cookie',
    sessionCookieName(opts.job.slug),
    '--site',
    `https://${opts.job.slug}.pages.dev`,
    '--brand',
    colors.accent,
    '--text',
    colors.text,
    '--muted',
    colors.muted,
    '--purpose',
    opts.job.prompt
  ];
  const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
  const log = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (result.status !== 0) {
    throw new Error(`auth-kit port.mjs failed (exit ${result.status ?? 'null'}): ${log}`);
  }
  return log;
}
