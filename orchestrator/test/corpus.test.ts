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
