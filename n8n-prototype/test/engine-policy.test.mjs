/**
 * The single source of truth for which work may use Grok.
 *
 * Owner rule, 2026-09-24: Grok is for Grok Imagine images and the logo,
 * palette and layout design roles only. FAIL INPUT: adding any other role to
 * GROK_ALLOWED_ROLES, or binding a judgement role back to a grok runner.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  ENGINE_CLAUDE,
  ENGINE_GROK,
  GROK_ALLOWED_ROLES,
  engineForRole,
  mayUseGrok
} from '../../orchestrator/scripts/lib/engine-policy.mjs';
import { BINDINGS } from '../bindings.mjs';
import { PROCESS } from '../process-map.mjs';

describe('engine policy', () => {
  test('the Grok allowlist is exactly logo, palette, layout, and cannot be widened', () => {
    assert.deepEqual([...GROK_ALLOWED_ROLES].sort(), ['layout', 'logo', 'palette']);
    assert.equal(Object.isFrozen(GROK_ALLOWED_ROLES), true);
    assert.throws(() => {
      /** @type {string[]} */ (/** @type {unknown} */ (GROK_ALLOWED_ROLES)).push('judge');
    });
  });

  test('FAIL INPUT: every non-design role in the process map resolves to claude', () => {
    const ids = PROCESS.map((step) => step.id);
    assert.ok(ids.length > GROK_ALLOWED_ROLES.length, 'process map did not load');
    for (const id of ids) {
      const expected = GROK_ALLOWED_ROLES.includes(id) ? ENGINE_GROK : ENGINE_CLAUDE;
      assert.equal(engineForRole(id), expected, id);
    }
    for (const role of ['brainstorm', 'testwriter', 'judge', 'user-refuse', 'pm', 'debugger', 'build', 'content', 'coder', 'intent', 'overnight']) {
      assert.equal(mayUseGrok(role), false, role);
      assert.equal(engineForRole(role), ENGINE_CLAUDE, role);
    }
  });

  test('unknown, empty and non-string roles never resolve to grok', () => {
    for (const role of [undefined, null, '', 'LOGO', ' logo', 42, {}, ['logo']]) {
      assert.equal(mayUseGrok(role), false, String(role));
      assert.equal(engineForRole(role), ENGINE_CLAUDE, String(role));
    }
  });

  test('no binding launches a grok runner; judgement roles bind to claude-role.mjs', () => {
    for (const [role, cmd] of Object.entries(BINDINGS)) {
      assert.equal(/grok-role\.mjs|\bgrok\b/.test(cmd), false, `${role}: ${cmd}`);
    }
    for (const role of ['brainstorm', 'testwriter', 'judge', 'user-refuse', 'pm', 'debugger']) {
      assert.match(BINDINGS[role], /roles\/claude-role\.mjs/, role);
    }
  });
});
