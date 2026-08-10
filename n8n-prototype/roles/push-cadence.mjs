#!/usr/bin/env node
/**
 * The push-cadence guard: refuse to let unpushed work pile up.
 *
 * 72 commits accumulated in one session against a standing instruction to
 * release incrementally. The mechanism of the failure matters: the pre-push gate
 * refused, I kept committing while blocked, and nobody was told until the pile
 * was ten times too big. The owner's instruction is explicit -- "always do at 10
 * not 70".
 *
 * This does not push. It reports, loudly and early, so the conflict between "the
 * gate refuses" and "release incrementally" surfaces at 10 commits when it is
 * cheap to resolve, instead of at 70 when it is not.
 */
import { execFileSync } from 'node:child_process';

/** Warn here. Ten is the owner's number. */
const WARN_AT = 10;
/** Hard stop: past this, stop committing and resolve the blocker. */
const REFUSE_AT = 20;

/**
 * Count commits on HEAD not present on the tracking remote.
 * @param {string} repoRoot repository root
 * @returns {number|null} unpushed count, or null when there is no upstream
 */
function unpushedCount(repoRoot) {
  try {
    const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: repoRoot,
      encoding: 'utf8'
    }).trim();
    const out = execFileSync('git', ['rev-list', '--count', `origin/${branch}..HEAD`], {
      cwd: repoRoot,
      encoding: 'utf8'
    });
    return Number(out.trim());
  } catch {
    return null;
  }
}

const repoRoot = process.argv[2] ?? process.cwd();
const n = unpushedCount(repoRoot);

if (n === null) {
  console.error('push-cadence: no upstream to compare against — cannot tell how much is unpushed');
  process.exit(1);
}

if (n >= REFUSE_AT) {
  console.error(
    `push-cadence REFUSE: ${n} commits unpushed (limit ${REFUSE_AT}).\n` +
      '  Stop committing and resolve the blocker. If the gate is refusing for a reason\n' +
      '  that cannot be cleared right now, say so and get a decision — do not keep\n' +
      '  stacking commits behind it. That is how 72 accumulated.'
  );
  process.exit(1);
}

if (n >= WARN_AT) {
  console.warn(`push-cadence WARN: ${n} commits unpushed (warn at ${WARN_AT}). Push now.`);
  process.exit(0);
}

console.log(`push-cadence: ${n} commit(s) unpushed — within cadence`);
