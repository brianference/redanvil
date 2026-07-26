import { describe, it, expect } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CORPUS_VERSION } from '../src/corpus/version';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RULE_LINE =
  /^- [a-z0-9-]+ \((blocker|major|minor|advisory), (det|judge|det\+judge|hook|process|visual)\): .+/;

describe('corpus', () => {
  it('has a semver corpus version', () => {
    expect(CORPUS_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('every rubric lane file has correctly formatted rule lines', async () => {
    const laneDir = join(repoRoot, 'rules', 'rubric');
    const files = (await readdir(laneDir)).filter((f) => f.endsWith('.md'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const lines = (await readFile(join(laneDir, f), 'utf8')).split('\n');
      const ruleLines = lines.filter((l) => l.startsWith('- '));
      expect(ruleLines.length, `${f} has rule lines`).toBeGreaterThan(0);
      for (const l of ruleLines) expect(l, `${f}: "${l}"`).toMatch(RULE_LINE);
    }
  });
});

describe('rubric markdown and encoded rules stay in lockstep', () => {
  it('every rule id in rules/rubric/*.md is encoded in RULES, and vice versa', async () => {
    const { readdir, readFile } = await import('node:fs/promises');
    const { RULES } = await import('../src/rubric/rules');
    const laneDir = join(repoRoot, 'rules', 'rubric');
    const files = (await readdir(laneDir)).filter((f) => f.endsWith('.md'));

    const documented = new Set<string>();
    for (const f of files) {
      const text = await readFile(join(laneDir, f), 'utf8');
      for (const line of text.split('\n')) {
        const m = /^- ([a-z0-9-]+) \(/.exec(line);
        if (m?.[1] !== undefined) documented.add(m[1]);
      }
    }
    const encoded = new Set(RULES.map((r) => r.id));

    // A rule authored in markdown but never encoded is scored by nothing, and a
    // rule encoded with no lane entry has no written definition to review
    // against. Both directions have bitten this repo, so both are asserted.
    const undocumented = [...encoded].filter((id) => !documented.has(id)).sort();
    const unencoded = [...documented].filter((id) => !encoded.has(id)).sort();
    expect(
      unencoded,
      `documented but not encoded (scored by nothing): ${unencoded.join(', ')}`
    ).toEqual([]);
    expect(undocumented, `encoded but not documented: ${undocumented.join(', ')}`).toEqual([]);
  });
});

describe('every det rule is actually runnable', () => {
  // A det rule has to be registered in THREE places: the rubric markdown, the
  // encoded RULES array, and the runner list in commands/gate.ts. The first two
  // were already bound by test. The third was not, so `fe-no-inline-width` was
  // documented, encoded, implemented in check.mjs — and never executed. It
  // failed closed as an unevaluated blocker rather than passing silently, which
  // is the right direction, but nothing said why.
  it('every det rule in RULES is wired into the gate runner', async () => {
    const gateSrc = await readFile(
      join(repoRoot, 'orchestrator', 'src', 'commands', 'gate.ts'),
      'utf8'
    );
    const { RULES } = await import('../src/rubric/rules');
    const detRules = RULES.filter((r) => r.method === 'det').map((r) => r.id);
    const missing = detRules.filter(
      (id) => !gateSrc.includes(`'${id}'`) && !gateSrc.includes(`"${id}"`)
    );
    expect(
      missing,
      `det rule(s) declared but never run by the gate: ${missing.join(', ')}`
    ).toEqual([]);
  });
});
