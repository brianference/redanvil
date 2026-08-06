/**
 * Register a scaffolded app into the managed team process so the gate and PM
 * can see it, and hand-building without roles is refused.
 *
 * A bare scaffold directory is how the design step got skipped: nothing forced
 * the managed path. Registration + PM entry + a hand-build guard close that.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

/** Managed-apps registry path under the monorepo root. */
export const MANAGED_APPS_FILE = join('.redanvil', 'managed-apps.json');

/** Per-app team binding file. */
export const TEAM_JSON = join('.redanvil', 'team.json');

/**
 * One managed (scaffolded) app entry.
 */
export interface ManagedAppEntry {
  /** App slug. */
  slug: string;
  /** Repo-relative directory (posix separators). */
  dir: string;
  /** Only allowed build entry: the PM. */
  entryPoint: 'pm';
  /** ISO registration time. */
  registeredAt: string;
  /** Hand-building is blocked until design roles have decided. */
  handBuildBlocked: true;
}

/**
 * Registry file shape.
 */
export interface ManagedAppsRegistry {
  /** Schema marker. */
  kind: 'managed-apps';
  /** Registered apps. */
  apps: ManagedAppEntry[];
}

/**
 * Per-app team binding written into the scaffold.
 */
export interface TeamBinding {
  /** App slug. */
  slug: string;
  /** Build must go through the PM. */
  entryPoint: 'pm';
  /** ISO time. */
  registeredAt: string;
  /** True until design deliverables are real and decided. */
  handBuildBlocked: true;
  /** Human next step. */
  nextCommand: string;
  /** Why hand-build is blocked. */
  reason: string;
}

/**
 * Result of engaging the team process after scaffold.
 */
export interface EngageTeamResult {
  /** Absolute path of .redanvil/team.json in the app. */
  teamJsonPath: string;
  /** Absolute path of monorepo managed-apps.json when registered; null if outDir is outside the monorepo. */
  registryPath: string | null;
  /** Absolute path of results stub when written. */
  resultPath: string | null;
  /** Lines for the scaffold CLI to print. */
  messages: string[];
  /** PM command the builder must run next. */
  nextCommand: string;
}

/**
 * Join path segments with `/` for portable registry paths.
 *
 * @param parts - Segments.
 * @returns POSIX-style relative path.
 */
function joinPosix(...parts: string[]): string {
  return parts
    .filter((p) => p.length > 0)
    .join('/')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/');
}

/**
 * Whether `child` is inside `parent` (or equal).
 *
 * @param parent - Parent directory.
 * @param child - Candidate path.
 * @returns True when child is under parent.
 */
function isInside(parent: string, child: string): boolean {
  const absParent = resolve(parent);
  const absChild = resolve(child);
  const rel = relative(absParent, absChild);
  return rel === '' || (!rel.startsWith(`..${sep}`) && !isAbsolute(rel) && rel !== '..');
}

/**
 * Load the managed-apps registry, or an empty one.
 *
 * @param repoRoot - Monorepo root.
 * @returns Registry object.
 */
export function loadManagedAppsRegistry(repoRoot: string): ManagedAppsRegistry {
  const path = join(repoRoot, MANAGED_APPS_FILE);
  if (!existsSync(path)) {
    return { kind: 'managed-apps', apps: [] };
  }
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as ManagedAppsRegistry;
    if (raw.kind !== 'managed-apps' || !Array.isArray(raw.apps)) {
      return { kind: 'managed-apps', apps: [] };
    }
    return raw;
  } catch {
    return { kind: 'managed-apps', apps: [] };
  }
}

/**
 * Persist the managed-apps registry.
 *
 * @param repoRoot - Monorepo root.
 * @param registry - Body to write.
 * @returns Path written.
 */
export function writeManagedAppsRegistry(
  repoRoot: string,
  registry: ManagedAppsRegistry
): string {
  const path = join(repoRoot, MANAGED_APPS_FILE);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
  return path;
}

/**
 * Register or update a managed app in the monorepo registry.
 *
 * @param repoRoot - Monorepo root.
 * @param entry - App entry.
 * @returns Path of the registry file.
 */
export function registerManagedApp(repoRoot: string, entry: ManagedAppEntry): string {
  const reg = loadManagedAppsRegistry(repoRoot);
  const rest = reg.apps.filter((a) => a.slug !== entry.slug);
  rest.push(entry);
  rest.sort((a, b) => a.slug.localeCompare(b.slug));
  return writeManagedAppsRegistry(repoRoot, { kind: 'managed-apps', apps: rest });
}

/**
 * Write the per-app team binding that forces the PM entry point.
 *
 * @param appDir - Scaffold output directory.
 * @param binding - Team binding body.
 * @returns Path written.
 */
export function writeTeamBinding(appDir: string, binding: TeamBinding): string {
  const path = join(appDir, TEAM_JSON);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(binding, null, 2)}\n`, 'utf8');
  return path;
}

/**
 * Read team binding when present.
 *
 * @param appDir - App root.
 * @returns Binding or null.
 */
export function readTeamBinding(appDir: string): TeamBinding | null {
  const path = join(appDir, TEAM_JSON);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as TeamBinding;
  } catch {
    return null;
  }
}

/**
 * Whether hand-building this app is blocked (must go through PM / design first).
 *
 * @param appDir - App root.
 * @returns True when team binding blocks hand-build.
 */
export function isHandBuildBlocked(appDir: string): boolean {
  const binding = readTeamBinding(appDir);
  return binding?.handBuildBlocked === true;
}

/**
 * Minimal gate-result stub so `redanvil pm results/<slug>.json` can plan.
 *
 * @param slug - App slug.
 * @returns JSON-serialisable result body.
 */
export function emptyResultStub(slug: string): Record<string, unknown> {
  return {
    kind: 'result',
    slug,
    finalScore: 0,
    threshold: 90,
    rules: [],
    note:
      'Scaffold stub — not a measurement. Run the PM: ' +
      `npx tsx orchestrator/src/cli.ts pm ${slug} --execute`
  };
}

/**
 * After scaffolding, engage the managed team process.
 *
 * - Writes `.redanvil/team.json` (PM entry, hand-build blocked)
 * - When outDir is under monorepoRoot, registers the app and writes a results stub
 * - Returns the PM command that is the only supported build entry
 *
 * @param opts - Paths and identity.
 * @returns Paths written and messages.
 */
export function engageTeamAfterScaffold(opts: {
  /** Scaffold output directory. */
  outDir: string;
  /** App slug from the job. */
  slug: string;
  /** Monorepo root (for registry + results). When outDir is outside it, registry is skipped. */
  monorepoRoot: string;
}): EngageTeamResult {
  const { outDir, slug, monorepoRoot } = opts;
  const absOut = resolve(outDir);
  const absRoot = resolve(monorepoRoot);
  const registeredAt = new Date().toISOString();

  let dirForRegistry = basename(absOut);
  if (isInside(absRoot, absOut)) {
    const rel = relative(absRoot, absOut);
    dirForRegistry = rel === '' || rel === '.' ? slug : joinPosix(...rel.split(sep));
  }

  // CLI shape: `redanvil pm <slug> --execute` (result defaults to results/<slug>.json,
  // appDir defaults to <repoRoot>/<slug>).
  const nextCommand = `npx tsx orchestrator/src/cli.ts pm ${slug} --execute`;

  const binding: TeamBinding = {
    slug,
    entryPoint: 'pm',
    registeredAt,
    handBuildBlocked: true,
    nextCommand,
    reason:
      'This app is managed by the agent team. Hand-building skips logo/layout ' +
      'design decisions. Run the PM; it assigns design roles first and refuses ' +
      'engineer/content/testwriter until design-refs decisions exist on disk.'
  };

  const teamJsonPath = writeTeamBinding(absOut, binding);
  const messages: string[] = [
    `team: registered ${slug} — entry point is the PM (not hand-build)`,
    `team: next: ${nextCommand}`,
    'team: hand-build blocked until design roles produce real DECISION.md files'
  ];

  let registryPath: string | null = null;
  let resultPath: string | null = null;

  if (isInside(absRoot, absOut)) {
    registryPath = registerManagedApp(absRoot, {
      slug,
      dir: dirForRegistry,
      entryPoint: 'pm',
      registeredAt,
      handBuildBlocked: true
    });
    messages.push(`team: gate/PM registry updated at ${MANAGED_APPS_FILE}`);

    const resultsDir = join(absRoot, 'results');
    mkdirSync(resultsDir, { recursive: true });
    resultPath = join(resultsDir, `${slug}.json`);
    if (!existsSync(resultPath)) {
      writeFileSync(
        resultPath,
        `${JSON.stringify(emptyResultStub(slug), null, 2)}\n`,
        'utf8'
      );
      messages.push(`team: wrote results stub ${joinPosix('results', `${slug}.json`)}`);
    }
  } else {
    messages.push(
      'team: outDir is outside the monorepo — local team.json only; register managed-apps after move'
    );
  }

  return {
    teamJsonPath,
    registryPath,
    resultPath,
    messages,
    nextCommand
  };
}
