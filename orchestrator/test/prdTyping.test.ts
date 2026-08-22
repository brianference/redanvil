import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  AnswerDidNotTakeError,
  assertAnswerTook,
  derivePicks,
  writePrdArtifacts
} from '../../n8n-prototype/roles/prd.mjs';

/**
 * PRD-role typing: negation-aware matching, provenance read-back, and the
 * overnight job-application-site prompt that produced appType Marketplace.
 *
 * Lives in this vitest lane so CI actually runs it (see autoGates.test.ts).
 */

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const JOB_PROMPT = readFileSync(
  join(REPO, '.redanvil', 'overnight', 'concept-job-application-site.txt'),
  'utf8'
);

/** Chips the live wizard actually shows for app type (en.wizard.appTypeChips). */
const APP_TYPE_OPTIONS = ['SaaS', 'Marketplace', 'Internal tool', 'Mobile app', 'API'];

/** Same chips plus Job board, so clause-scoping can name that answer. */
const APP_TYPE_WITH_JOB_BOARD = [...APP_TYPE_OPTIONS, 'Job board'];

const APP_TYPE_GROUP = { label: 'App type', options: APP_TYPE_OPTIONS };
const APP_TYPE_GROUP_WITH_JOB_BOARD = {
  label: 'App type',
  options: APP_TYPE_WITH_JOB_BOARD
};
const AUTH_GROUP = { label: 'Does this app need sign-in?', options: ['Yes', 'No'] };

/** Scratch dirs created by a test; drained in afterEach. */
const scratchDirs: string[] = [];

afterEach(() => {
  for (const d of scratchDirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
});

/**
 * A unique scratch directory that afterEach will delete.
 * @returns absolute path
 */
function scratch(): string {
  const dir = join(
    tmpdir(),
    `redanvil-prd-typing-${process.pid}-${Date.now()}-${scratchDirs.length}`
  );
  mkdirSync(dir, { recursive: true });
  scratchDirs.push(dir);
  return dir;
}

/**
 * First pick for a group, or undefined.
 * @param group wizard group
 * @param prompt prompt text
 * @returns option or undefined
 */
function pick(group: { label: string; options: string[] }, prompt: string): string | undefined {
  return derivePicks(group, prompt)[0];
}

describe('prd.mjs derivation — job-application-site prompt (exact file)', () => {
  it('the real overnight prompt is the one that said "not a marketplace"', () => {
    // Guard: a paraphrase of the prompt would make every later assertion
    // about "this prompt" unfalsifiable.
    expect(JOB_PROMPT).toMatch(/What this is NOT:/);
    expect(JOB_PROMPT).toMatch(/it is\s+not a marketplace/);
    expect(JOB_PROMPT).toMatch(/Build a job application site for a person who is job hunting/);
  });

  it('does NOT return Marketplace for the exact overnight prompt', () => {
    // Known-bad: ANSWER_RULES matched "marketplace" inside "it is not a
    // marketplace" and "listings" inside "save a listing as an application".
    const appType = pick(APP_TYPE_GROUP, JOB_PROMPT);
    expect(appType).not.toBe('Marketplace');
  });

  it('sign-in returns Yes for the exact overnight prompt', () => {
    expect(pick(AUTH_GROUP, JOB_PROMPT)).toBe('Yes');
  });
});

describe('prd.mjs derivation — negation is clause-scoped', () => {
  it('A marketplace for buyers and sellers still returns Marketplace', () => {
    // The positive control: a negation-blind delete of the Marketplace rule
    // would also pass the overnight-prompt test. This one would then fail.
    expect(pick(APP_TYPE_GROUP, 'A marketplace for buyers and sellers')).toBe('Marketplace');
  });

  it('a prompt that only names marketplace under negation does not pick Marketplace', () => {
    // Isolates negation. The overnight prompt also contains "job application"
    // which a more-specific SaaS rule matches first, so deleting negation
    // leaves that test green. This prompt has no other type signal.
    expect(pick(APP_TYPE_GROUP, 'it is not a marketplace')).not.toBe('Marketplace');
  });

  it('it is not a marketplace, it is a job board returns the job-board answer', () => {
    // Clause scoping, not whole-prompt veto: the negated marketplace clause
    // must not prevent the other clause from selecting Job board.
    expect(
      pick(APP_TYPE_GROUP_WITH_JOB_BOARD, 'it is not a marketplace, it is a job board')
    ).toBe('Job board');
  });

  it('a negated job-board clause does not veto a later genuine Marketplace', () => {
    expect(
      pick(
        APP_TYPE_GROUP_WITH_JOB_BOARD,
        'it is not a job board, it is a marketplace for buyers and sellers'
      )
    ).toBe('Marketplace');
  });
});

describe('prd.mjs provenance — intended vs actual', () => {
  it('assertAnswerTook throws when intended and actual differ', () => {
    expect(() => assertAnswerTook('Does this app need sign-in?', 'Yes', 'No')).toThrow(
      AnswerDidNotTakeError
    );
    expect(() => assertAnswerTook('Does this app need sign-in?', 'Yes', 'Yes')).not.toThrow();
  });

  it('a read-back mismatch refuses to write a PRD', () => {
    const dir = scratch();
    const markdown = 'x'.repeat(2500);
    expect(() =>
      writePrdArtifacts(
        dir,
        markdown,
        JOB_PROMPT,
        [{ group: 'Does this app need sign-in?', intended: 'Yes', actual: 'No' }],
        'https://redanvil.pages.dev/'
      )
    ).toThrow(AnswerDidNotTakeError);
    expect(existsSync(join(dir, 'PRD.md'))).toBe(false);
    expect(existsSync(join(dir, 'prd-provenance.json'))).toBe(false);
  });

  it('matching intended and actual writes provenance that records both', () => {
    const dir = scratch();
    const markdown = 'x'.repeat(2500);
    writePrdArtifacts(
      dir,
      markdown,
      JOB_PROMPT,
      [{ group: 'Does this app need sign-in?', intended: 'Yes', actual: 'Yes' }],
      'https://redanvil.pages.dev/'
    );
    expect(existsSync(join(dir, 'PRD.md'))).toBe(true);
    const provenance = JSON.parse(readFileSync(join(dir, 'prd-provenance.json'), 'utf8')) as {
      wizardAnswers: Array<{ group: string; intended: string; actual: string }>;
    };
    expect(provenance.wizardAnswers).toEqual([
      { group: 'Does this app need sign-in?', intended: 'Yes', actual: 'Yes' }
    ]);
  });
});
