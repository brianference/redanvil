import { describe, it, expect } from 'vitest';
import { parseOutcomes } from '../src/schemas/outcomes';
import { indexOutcomes, computeScore } from '../src/gate/score';
import { loadRubric } from '../src/rubric/index';
import { ValidationError } from '../src/errors';

const rules = loadRubric();

describe('parseOutcomes', () => {
  it('accepts a well-formed verdict list', () => {
    const out = parseOutcomes('[{"ruleId":"u-typing-strict","passed":true}]', 'f.json');
    expect(out).toEqual([{ ruleId: 'u-typing-strict', passed: true }]);
  });

  it('rejects a truthy non-boolean passed value', () => {
    // This exact shape made the gate report 100/100 while listing 28 failed
    // blockers, and exit 0.
    expect(() => parseOutcomes('[{"ruleId":"u-typing-strict","passed":"yes"}]', 'f.json')).toThrow(
      ValidationError
    );
  });

  it('rejects a non-array payload', () => {
    expect(() => parseOutcomes('{"ruleId":"x","passed":true}', 'f.json')).toThrow(ValidationError);
  });

  it('rejects malformed JSON', () => {
    expect(() => parseOutcomes('{not json', 'f.json')).toThrow(ValidationError);
  });
});

describe('indexOutcomes hardening', () => {
  it('treats a truthy non-boolean as a failure, not a pass', () => {
    const smuggled = [{ ruleId: 'u-typing-strict', passed: 'yes' }] as unknown as {
      ruleId: string;
      passed: boolean;
    }[];
    expect(indexOutcomes(smuggled).get('u-typing-strict')).toBe(false);
  });

  it('cannot be driven to a passing score by a malformed verdict file', () => {
    const smuggled = rules.map((r) => ({ ruleId: r.id, passed: 'yes' })) as unknown as {
      ruleId: string;
      passed: boolean;
    }[];
    const { score, blockers } = computeScore(smuggled, rules);
    expect(score).toBe(0);
    expect(blockers.length).toBeGreaterThan(0);
  });
});
