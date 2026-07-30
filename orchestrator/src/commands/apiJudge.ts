import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, relative } from 'node:path';
import { runGrok, parseGrokJson, newSessionId } from '../grok/harness';

/**
 * The judgment half of `u-api-real-output`.
 *
 * The deterministic half boots the app, calls every declared route and fails a
 * non-2xx, an empty body, an empty collection under `nonEmpty`, or placeholder
 * text. It cannot decide the question that actually matters, because that
 * question has no code oracle: does this answer DELIVER what the product claims?
 *
 * QuickFlight is the worked example, captured live rather than imagined:
 * `/api/fares` returns `200 {"quotes":[],"provider":null,"degraded":true,
 * "degradedReason":"Live fares are not configured..."}`. Every deterministic
 * check passes. The status is right, the body is not empty — it has four keys —
 * the shape validates, and there is not one fare in it. The home page offers
 * live fares. A machine sees a healthy endpoint; a reader sees a product that
 * does not do what it says.
 *
 * So a second model reads the captured traffic against the product's own claims
 * and answers per route. This is the one place in this work where a second
 * opinion is worth paying for: disagreement is informative here, whereas on the
 * deterministic checks a red test is stronger evidence than any model agreeing.
 *
 * Fail-closed by construction. `u-api-real-output` is a blocker and every
 * method is in FAIL_CLOSED_METHODS, so with no recorded verdict the rule fails
 * and the score is zero — the pass cannot be quietly skipped. Duplicate
 * outcomes for one rule also resolve fail-closed, so a judge PASS can never
 * erase a deterministic FAIL.
 */

/** Where the det half writes captured live traffic. */
const EVIDENCE_DIR = 'evidence';
/** Grok's model for this pass. */
const JUDGE_MODEL = 'grok-4.5';
/** Wall-clock ceiling for the judge call. */
const JUDGE_TIMEOUT_MS = 300_000;

/** One route's captured request/response pair. */
interface CapturedRoute {
  route: string;
  path: string;
  method: string;
  status: number | null;
  responseBody: string;
  error: string | null;
}

/** A recorded verdict, matching VerdictSchema's judge shape. */
export interface JudgeVerdict {
  ruleId: string;
  passed: boolean;
  method: 'judge';
  evidence: string[];
  note: string;
  reviewedAt: string;
  reviewedCommit: string;
}

/** Grok's per-route finding. */
interface RouteFinding {
  route: string;
  delivers: boolean;
  reason: string;
}

/**
 * Read a JSON file, or null when absent/malformed.
 *
 * @param file - Absolute path.
 * @returns Parsed value, or null.
 */
function readJson(file: string): unknown | null {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as unknown;
  } catch {
    return null;
  }
}

/**
 * The app's slug, used to name evidence files.
 *
 * @param appDir - App directory.
 * @returns Slug, or 'app'.
 */
export function appSlug(appDir: string): string {
  const conformance = readJson(join(appDir, 'conformance.json')) as { slug?: unknown } | null;
  return typeof conformance?.slug === 'string' ? conformance.slug : 'app';
}

/**
 * The files stating what this product claims to do.
 *
 * Named rather than inlined, so the judge reads them itself. The judge has to
 * measure the app against what it PROMISED, and a claim retyped into a prompt
 * is a claim that can be quietly softened to fit the result.
 *
 * @param appDir - App directory.
 * @returns File names that exist, or an empty array.
 */
export function findClaimFiles(appDir: string): string[] {
  return ['PRD.md', 'README.md', 'BUILD_SPEC.md'].filter((name) =>
    existsSync(join(appDir, name))
  );
}

/**
 * Build the judge prompt.
 *
 * Deliberately narrow. One question per route, answered from the captured bytes
 * only — a judge that reasons about what an endpoint probably does has stopped
 * being evidence. It is told explicitly that a 200 is not the question, because
 * the whole failure class here wears a 200.
 *
 * The evidence is referenced BY PATH, not inlined. Grok runs with `--cwd appDir`
 * and the prompt is passed as a command-line argument, so inlining 60KB of
 * captured traffic overran the Windows ~32KB command-line ceiling and the spawn
 * died with ENAMETOOLONG before the model saw anything. Pointing at files also
 * happens to be the more honest arrangement: the judge reads the same artifact
 * on disk that the verdict will cite as its evidence, rather than a copy that
 * passed through this process and could differ from it.
 *
 * @param evidenceRel - Repo-relative path to the captured traffic.
 * @param claimFiles - Names of the files stating the product's claims.
 * @returns Prompt text.
 */
export function buildJudgePrompt(evidenceRel: string, claimFiles: string[]): string {
  const posix = evidenceRel.split('\\').join('/');
  return [
    'You are judging ONE rubric rule: u-api-real-output, judgment half.',
    '',
    `Read these files in the current directory:`,
    `  1. ${posix} — live request/response pairs captured against the real runtime.`,
    ...claimFiles.map((f, i) => `  ${i + 2}. ${f} — what this product claims it does.`),
    '',
    'Question, asked once per route in the captured traffic: does this response',
    'DELIVER the functionality the product claims for it, or is it merely',
    'well-formed?',
    '',
    'A 200 is not the question. A deterministic check already passed the status,',
    'the shape and the non-emptiness. The failure you are looking for wears a 200:',
    'an endpoint that answers correctly and returns nothing a user could use --',
    'an empty collection inside a populated envelope, a degraded fallback that the',
    'UI presents as the real feature, a stub that returns the right keys.',
    '',
    'Rules for your answer:',
    '- Judge ONLY from the captured bytes in the evidence file. Do not read the',
    '  handler source and reason about what it probably does. If the capture does',
    '  not settle a route, fail that route and say why.',
    '- Cite the specific field or count that decides each verdict.',
    '- An endpoint whose own response says it is degraded, unconfigured, or serving',
    '  a fallback does NOT deliver a claim the product advertises as live.',
    '- Default to delivers=false when uncertain. An unproven claim is not a pass.',
    '',
    'Return ONLY a JSON object, no markdown fence, no commentary:',
    '{"findings":[{"route":"/api/x","delivers":true,"reason":"cites the field"}],',
    ' "summary":"one sentence"}'
  ].join('\n');
}

/**
 * Pull the findings object out of Grok's reply.
 *
 * Tolerates a fenced block, because models add fences even when told not to.
 * Returns null rather than guessing when nothing parses — a judge whose output
 * cannot be read has not returned a verdict, and inventing one would be exactly
 * the fabrication this rule exists to catch.
 *
 * @param text - Raw reply text.
 * @returns Findings, or null.
 */
export function parseFindings(
  text: string
): { findings: RouteFinding[]; summary: string } | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1)) as {
      findings?: unknown;
      summary?: unknown;
    };
    if (!Array.isArray(parsed.findings)) return null;
    const findings = parsed.findings.filter(
      (f): f is RouteFinding =>
        typeof f === 'object' &&
        f !== null &&
        typeof (f as RouteFinding).route === 'string' &&
        typeof (f as RouteFinding).delivers === 'boolean'
    );
    if (findings.length === 0) return null;
    return {
      findings,
      summary: typeof parsed.summary === 'string' ? parsed.summary : ''
    };
  } catch {
    return null;
  }
}

/**
 * Current commit of the app, for verdict freshness.
 *
 * @param appDir - App directory.
 * @returns Commit sha, or null.
 */
function headCommit(appDir: string): string | null {
  try {
    return execFileSync('git', ['-C', appDir, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Run the API-reality judge over one app and write its verdict.
 *
 * @param appDir - App directory.
 * @param opts - Optional injected runner, for tests.
 * @returns Exit code, message, and the verdict when one was produced.
 */
export async function runApiJudge(
  appDir: string,
  opts: { run?: (cwd: string, prompt: string) => Promise<string | null> } = {}
): Promise<{ exitCode: number; message: string; verdict: JudgeVerdict | null }> {
  const slug = appSlug(appDir);
  const evidenceRel = join(EVIDENCE_DIR, `api-live-${slug}.json`);
  const evidenceAbs = join(appDir, evidenceRel);
  const captured = readJson(evidenceAbs) as { routes?: CapturedRoute[] } | null;

  if (captured === null || !Array.isArray(captured.routes) || captured.routes.length === 0) {
    return {
      exitCode: 2,
      message:
        `no captured traffic at ${evidenceRel}. Run the u-api-real-output check first — ` +
        'the judge reads real captured responses, never the source.',
      verdict: null
    };
  }

  const claimFiles = findClaimFiles(appDir);
  if (claimFiles.length === 0) {
    return {
      exitCode: 2,
      message:
        'the app states no product claims (no PRD.md, README.md or BUILD_SPEC.md), ' +
        'so there is nothing to judge the responses against.',
      verdict: null
    };
  }

  const prompt = buildJudgePrompt(evidenceRel, claimFiles);
  const run =
    opts.run ??
    (async (cwd: string, p: string): Promise<string | null> => {
      const result = await runGrok(cwd, p, {
        sessionId: newSessionId(),
        model: JUDGE_MODEL,
        timeoutMs: JUDGE_TIMEOUT_MS
      });
      if (result.code !== 0) return null;
      return parseGrokJson(result.stdout)?.text ?? null;
    });

  const reply = await run(appDir, prompt);
  if (reply === null) {
    return { exitCode: 2, message: 'the judge did not return a usable reply', verdict: null };
  }

  const parsed = parseFindings(reply);
  if (parsed === null) {
    return {
      exitCode: 2,
      message: `could not parse a verdict out of the judge's reply:\n${reply.slice(0, 600)}`,
      verdict: null
    };
  }

  const failed = parsed.findings.filter((f) => !f.delivers);
  const commit = headCommit(appDir);
  if (commit === null) {
    return {
      exitCode: 2,
      message: 'the app is not a git repository, so a verdict cannot be bound to a commit',
      verdict: null
    };
  }

  const note =
    failed.length === 0
      ? `${parsed.findings.length} route(s) reviewed against the product's claims; each delivers. ${parsed.summary}`.trim()
      : `${failed.length} of ${parsed.findings.length} route(s) answer without delivering: ` +
        failed.map((f) => `${f.route} — ${f.reason}`).join('; ');

  const verdict: JudgeVerdict = {
    ruleId: 'u-api-real-output',
    passed: failed.length === 0,
    method: 'judge',
    // Relative to the CURRENT WORKING DIRECTORY, not to the app. parseVerdicts
    // resolves evidence with `join(repoRoot, path)` where repoRoot is
    // `process.cwd()`, so an app-relative path is looked up under the
    // orchestrator repo, is not found, and the verdict is rejected — which
    // fails closed, but for a reason that has nothing to do with the app. The
    // gate is invoked from the monorepo root against an app directory, so this
    // is the path that actually resolves there. An absolute path would not:
    // `join` does not discard its first argument for an absolute second one.
    evidence: [relative(process.cwd(), evidenceAbs).split('\\').join('/')],
    // VerdictSchema requires min 3 chars; a truncated note is still a real one.
    note: note.slice(0, 2000),
    reviewedAt: new Date().toISOString(),
    reviewedCommit: commit
  };

  const outRel = join(EVIDENCE_DIR, `judge-api-${slug}.json`);
  const outAbs = join(appDir, outRel);
  mkdirSync(dirname(outAbs), { recursive: true });
  // A verdict LIST, because that is what `--judge` parses.
  writeFileSync(outAbs, JSON.stringify([verdict], null, 2) + '\n');

  return {
    exitCode: verdict.passed ? 0 : 1,
    message:
      `${verdict.passed ? 'PASS' : 'FAIL'} u-api-real-output (judge half)\n${note}\n` +
      `wrote ${outRel} — feed it back with: npm run gate -- <appDir> --judge ${outRel}`,
    verdict
  };
}
