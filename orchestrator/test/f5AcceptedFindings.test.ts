/**
 * F5 release-waiver path: per-finding acceptance + source-commit freshness.
 *
 * Product decision: ship with findings RECORDED and accepted one-by-one; fix
 * them next release. Not a blanket F5 exemption.
 *
 * Cases (must all hold):
 *  a. 3 failing findings, all accepted at the right commit → independentReviewOk true
 *  b. Same, one finding not listed → false
 *  c. Same, accepted entries at a DIFFERENT commit → false
 *  d. Wildcard / 'all' entry → rejected, false
 *  e. No report at all → false
 *  f. App source changes after the review → stale → false
 *  g. (run separately) typecheck + lint + existing tests
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  independentReviewOkFromReport,
  readJudgeDiffReport,
  type IndependentReviewReport
} from '../src/loop/independentReview';
import { loadProductJudgementOpts } from '../src/team/finishOpts';
import { independentReviewOk } from '../src/team/productJudgement.mjs';
import {
  isBlanketAcceptedFinding,
  loadAcceptedFindings,
  findingIsAccepted
} from '../src/gate/acceptedFindings.mjs';
import { reviewPinCommit, newestSourceCommit } from '../src/git/newestSourceCommit.mjs';

const made: string[] = [];

afterEach(() => {
  for (const d of made.splice(0)) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }
});

/**
 * @param args - git args
 * @param cwd - working directory
 * @returns trimmed stdout
 */
function git(args: string[], cwd: string): string {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${r.stderr || r.stdout}`);
  }
  return (r.stdout ?? '').trim();
}

/**
 * Fixture repo with an app that has committed source (so source-pin ≠ evidence noise).
 *
 * @returns paths and the source pin commit
 */
function fixtureWithSource(): {
  repo: string;
  app: string;
  slug: string;
  sourceCommit: string;
} {
  const repo = mkdtempSync(join(tmpdir(), 'f5-accept-'));
  made.push(repo);
  git(['init', '-q'], repo);
  git(['config', 'user.email', 't@t'], repo);
  git(['config', 'user.name', 't'], repo);

  const slug = 'demo-app';
  const app = join(repo, slug);
  mkdirSync(join(app, 'src'), { recursive: true });
  mkdirSync(join(app, 'evidence'), { recursive: true });
  mkdirSync(join(repo, 'evidence'), { recursive: true });
  mkdirSync(join(repo, '.redanvil'), { recursive: true });

  writeFileSync(join(app, 'src', 'main.ts'), 'export const n = 1;\n', 'utf8');
  git(['add', `${slug}/src/main.ts`], repo);
  git(['commit', '-qm', 'app source'], repo);
  const sourceCommit = git(['rev-parse', 'HEAD'], repo);

  return { repo, app, slug, sourceCommit };
}

/**
 * Three failing findings used across acceptance cases.
 */
const THREE_FINDINGS = [
  {
    title: 'missing rate limit',
    citation: 'functions/api/x.ts:12',
    detail: 'no throttle on write path',
    passed: false as const
  },
  {
    title: 'hardcoded secret shape',
    citation: 'src/lib/env.ts:4',
    detail: 'token pattern in source',
    passed: false as const
  },
  {
    title: 'unverified theme paint',
    citation: 'src/theme.css:1',
    detail: 'hero may stay black in light mode',
    passed: false as const
  }
];

/**
 * @param commit - pin commit
 * @param slug - app slug
 * @param overrides - field overrides
 */
function failingReport(
  commit: string,
  slug: string,
  overrides: Partial<IndependentReviewReport> = {}
): IndependentReviewReport {
  return {
    kind: 'independent-diff-review',
    slug,
    commit,
    reviewedAt: new Date().toISOString(),
    diffHash: 'c'.repeat(64),
    completed: true,
    ok: false,
    foundNothingExplicit: false,
    findings: THREE_FINDINGS.map((f) => ({ ...f })),
    rawExcerpt: 'fixture',
    mode: 'fixture',
    ...overrides
  };
}

/**
 * Acceptance rows for all three findings at `commit`.
 *
 * @param app - slug
 * @param commit - reviewed commit
 * @param dropTitle - optional title to omit (case b)
 */
function acceptAll(
  app: string,
  commit: string,
  dropTitle?: string
): Array<{
  app: string;
  title: string;
  citation: string;
  commit: string;
  since: string;
  reason: string;
}> {
  return THREE_FINDINGS.filter((f) => f.title !== dropTitle).map((f) => ({
    app,
    title: f.title,
    citation: f.citation,
    commit,
    since: '2026-08-04',
    reason: `accepted for this release: ${f.title}`
  }));
}

/**
 * Write known-issues.json with acceptedFindings (and empty waivers).
 *
 * @param repo - repo root
 * @param acceptedFindings - rows
 */
function writeKnownIssues(repo: string, acceptedFindings: unknown[]): void {
  writeFileSync(
    join(repo, '.redanvil', 'known-issues.json'),
    `${JSON.stringify({ waivers: [], acceptedFindings }, null, 2)}\n`,
    'utf8'
  );
}

/**
 * Write judge-diff report under app evidence/.
 *
 * @param app - app dir
 * @param slug - slug
 * @param body - report
 */
function writeReport(app: string, slug: string, body: IndependentReviewReport): void {
  writeFileSync(
    join(app, 'evidence', `judge-diff-${slug}.json`),
    `${JSON.stringify(body, null, 2)}\n`,
    'utf8'
  );
}

describe('F5 accepted findings (release waiver path)', () => {
  it('a. 3 failing findings, all accepted at the right commit → independentReviewOk true', () => {
    const { repo, app, slug, sourceCommit } = fixtureWithSource();
    expect(reviewPinCommit(app)).toBe(sourceCommit);

    const body = failingReport(sourceCommit, slug);
    writeReport(app, slug, body);
    writeKnownIssues(repo, acceptAll(slug, sourceCommit));

    expect(
      independentReviewOkFromReport(body, sourceCommit, {
        app: slug,
        acceptedFindings: loadAcceptedFindings(repo, slug)
      })
    ).toBe(true);
    expect(loadProductJudgementOpts(app, slug).independentReviewOk).toBe(true);
    expect(independentReviewOk(app, slug)).toBe(true);

    // Findings remain failures in the report — waiver does not rewrite them.
    const onDisk = readJudgeDiffReport(app, slug);
    expect(onDisk?.ok).toBe(false);
    expect(onDisk?.findings.filter((f) => f.passed === false)).toHaveLength(3);
  });

  it('b. same, but ONE finding not listed → false', () => {
    const { repo, app, slug, sourceCommit } = fixtureWithSource();
    const body = failingReport(sourceCommit, slug);
    writeReport(app, slug, body);
    writeKnownIssues(repo, acceptAll(slug, sourceCommit, 'hardcoded secret shape'));

    const accepted = loadAcceptedFindings(repo, slug);
    expect(accepted).toHaveLength(2);
    expect(independentReviewOkFromReport(body, sourceCommit, { app: slug, acceptedFindings: accepted })).toBe(
      false
    );
    expect(loadProductJudgementOpts(app, slug).independentReviewOk).toBe(false);
    expect(independentReviewOk(app, slug)).toBe(false);
  });

  it('c. same, but accepted entries recorded at a DIFFERENT commit → false', () => {
    const { repo, app, slug, sourceCommit } = fixtureWithSource();
    const other = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
    expect(other).not.toBe(sourceCommit);

    const body = failingReport(sourceCommit, slug);
    writeReport(app, slug, body);
    writeKnownIssues(repo, acceptAll(slug, other));

    const accepted = loadAcceptedFindings(repo, slug);
    expect(accepted).toHaveLength(3);
    // Loaded, but commit mismatch means none apply.
    expect(
      findingIsAccepted(THREE_FINDINGS[0]!, accepted, slug, sourceCommit)
    ).toBe(false);
    expect(independentReviewOkFromReport(body, sourceCommit, { app: slug, acceptedFindings: accepted })).toBe(
      false
    );
    expect(loadProductJudgementOpts(app, slug).independentReviewOk).toBe(false);
  });

  it("d. wildcard / 'all' entry → rejected, false", () => {
    const { repo, app, slug, sourceCommit } = fixtureWithSource();
    const body = failingReport(sourceCommit, slug);
    writeReport(app, slug, body);

    // Blanket forms that must never accept anything.
    writeKnownIssues(repo, [
      {
        app: slug,
        title: 'all',
        citation: 'all',
        commit: sourceCommit,
        since: '2026-08-04',
        reason: 'blanket — must be rejected'
      },
      {
        app: slug,
        title: '*',
        citation: '*',
        commit: sourceCommit,
        since: '2026-08-04',
        reason: 'wildcard — must be rejected'
      },
      {
        app: slug,
        title: THREE_FINDINGS[0]!.title,
        citation: '*',
        commit: sourceCommit,
        since: '2026-08-04',
        reason: 'partial wildcard — must be rejected'
      }
    ]);

    const accepted = loadAcceptedFindings(repo, slug);
    // Loader drops blankets — nothing matchable remains.
    expect(accepted).toHaveLength(0);
    expect(isBlanketAcceptedFinding({ title: 'all', citation: 'x.ts:1' })).toBe(true);
    expect(isBlanketAcceptedFinding({ title: '*', citation: 'x.ts:1' })).toBe(true);

    expect(independentReviewOkFromReport(body, sourceCommit, { app: slug, acceptedFindings: accepted })).toBe(
      false
    );
    expect(loadProductJudgementOpts(app, slug).independentReviewOk).toBe(false);
  });

  it('e. no report at all → false (unchanged)', () => {
    const { app, slug, sourceCommit } = fixtureWithSource();
    expect(readJudgeDiffReport(app, slug)).toBeNull();
    expect(independentReviewOkFromReport(null, sourceCommit)).toBe(false);
    expect(loadProductJudgementOpts(app, slug).independentReviewOk).toBe(false);
    expect(independentReviewOk(app, slug)).toBe(false);
  });

  it('f. app source changes after the review → stale → false', () => {
    const { repo, app, slug, sourceCommit } = fixtureWithSource();
    const body = failingReport(sourceCommit, slug);
    writeReport(app, slug, body);
    writeKnownIssues(repo, acceptAll(slug, sourceCommit));

    // Acceptance would pass at the original pin…
    expect(loadProductJudgementOpts(app, slug).independentReviewOk).toBe(true);

    // …but a real source edit moves the pin; review is now stale.
    writeFileSync(join(app, 'src', 'main.ts'), 'export const n = 2;\n', 'utf8');
    git(['add', `${slug}/src/main.ts`], repo);
    git(['commit', '-qm', 'source changed'], repo);
    const newSource = git(['rev-parse', 'HEAD'], repo);
    expect(newSource).not.toBe(sourceCommit);
    expect(newestSourceCommit(repo, slug)).toBe(newSource);
    expect(reviewPinCommit(app)).toBe(newSource);

    // Report still names the old commit; acceptances are for the old commit.
    expect(loadProductJudgementOpts(app, slug).independentReviewOk).toBe(false);
    expect(independentReviewOk(app, slug)).toBe(false);
    expect(
      independentReviewOkFromReport(body, newSource, {
        app: slug,
        acceptedFindings: loadAcceptedFindings(repo, slug)
      })
    ).toBe(false);
  });

  it('evidence-only commit after review does NOT stale the pin (treadmill fix)', () => {
    const { repo, app, slug, sourceCommit } = fixtureWithSource();
    const body = failingReport(sourceCommit, slug);
    writeReport(app, slug, body);
    writeKnownIssues(repo, acceptAll(slug, sourceCommit));
    expect(loadProductJudgementOpts(app, slug).independentReviewOk).toBe(true);

    // Gate-style evidence commit under the app — excluded from source pin.
    writeFileSync(
      join(app, 'evidence', 'measurement-meta.json'),
      JSON.stringify({ at: new Date().toISOString() }),
      'utf8'
    );
    git(['add', `${slug}/evidence/measurement-meta.json`], repo);
    git(['commit', '-qm', 'evidence only'], repo);
    const head = git(['rev-parse', 'HEAD'], repo);
    expect(head).not.toBe(sourceCommit);
    // Source pin unchanged; F5 still closes.
    expect(reviewPinCommit(app)).toBe(sourceCommit);
    expect(loadProductJudgementOpts(app, slug).independentReviewOk).toBe(true);
    expect(independentReviewOk(app, slug)).toBe(true);
  });

  it('missing report / incomplete / empty-diff stay false regardless of acceptances', () => {
    const { repo, slug, sourceCommit } = fixtureWithSource();
    writeKnownIssues(repo, acceptAll(slug, sourceCommit));
    const accepted = loadAcceptedFindings(repo, slug);

    expect(independentReviewOkFromReport(null, sourceCommit, { app: slug, acceptedFindings: accepted })).toBe(
      false
    );

    const incomplete = failingReport(sourceCommit, slug, { completed: false });
    expect(
      independentReviewOkFromReport(incomplete, sourceCommit, { app: slug, acceptedFindings: accepted })
    ).toBe(false);

    const emptyDiff = failingReport(sourceCommit, slug, {
      mode: 'empty-diff',
      nothingToReview: true,
      findings: [],
      foundNothingExplicit: false,
      ok: false
    });
    // Even with acceptances present, empty-diff never passes.
    expect(
      independentReviewOkFromReport(emptyDiff, sourceCommit, { app: slug, acceptedFindings: accepted })
    ).toBe(false);
  });
});
