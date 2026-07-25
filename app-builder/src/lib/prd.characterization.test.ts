import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { generatePrd, type Prd, type TokenEstimate } from './prd';
import { estimate } from './estimate';
import type { WizardAnswers } from './job';

/**
 * Characterization cases covering varied generatePrd inputs.
 * Digests were captured against the pre-split prd.ts and must remain stable.
 */
const CASES: ReadonlyArray<{
  id: string;
  answers: Pick<WizardAnswers, 'prompt' | 'appType' | 'hasAuth' | 'entities'> &
    Partial<Pick<WizardAnswers, 'dataStorage' | 'hasRealtime' | 'integrations'>>;
  cost: TokenEstimate;
}> = [
  {
    id: 'dashboard-auth-two-entities',
    answers: {
      prompt: 'Build an app for tracking tesla driving stats',
      appType: 'dashboard',
      hasAuth: true,
      entities: 'trips, drivers'
    },
    cost: estimate({ features: 3, hasAuth: true, entities: 2 })
  },
  {
    id: 'mobile-no-auth-two-entities',
    answers: {
      prompt: 'an app to remind you when your dog needs grooming, vet visits, ear cleaning',
      appType: 'Mobile app',
      hasAuth: false,
      entities: 'Reminder, Pet',
      dataStorage: 'simple',
      hasRealtime: false,
      integrations: ''
    },
    cost: estimate({ features: 3, hasAuth: false, entities: 2, scopeSignals: 2 })
  },
  {
    id: 'marketplace-auth-scoped',
    answers: {
      prompt: 'A marketplace for local makers with listings and search',
      appType: 'Marketplace',
      hasAuth: true,
      entities: 'Listing, Seller',
      dataStorage: 'relational',
      hasRealtime: true,
      integrations: 'Stripe, Email'
    },
    cost: estimate({ features: 4, hasAuth: true, entities: 2, scopeSignals: 4 })
  },
  {
    id: 'empty-entities-no-auth',
    answers: {
      prompt: 'Simple status page for uptime checks',
      appType: 'internal tool',
      hasAuth: false,
      entities: '',
      dataStorage: 'none',
      hasRealtime: false,
      integrations: ''
    },
    cost: estimate({ features: 2, hasAuth: false, entities: 0 })
  },
  {
    id: 'long-prompt-many-entities',
    answers: {
      prompt:
        'A Shift Scheduling app for Small Businesses with employee roles and swaps that also handles overtime approvals, manager dashboards, payroll export, and mobile notifications for last-minute coverage gaps across multiple store locations',
      appType: 'SaaS',
      hasAuth: true,
      entities: 'shifts, employees, locations, swap requests, overtime logs',
      dataStorage: 'relational',
      hasRealtime: true,
      integrations: 'Twilio, Slack'
    },
    cost: estimate({ features: 8, hasAuth: true, entities: 5, scopeSignals: 6 })
  }
];

/**
 * Stable payload string for hashing a full Prd (slug/title/prompt/markdown).
 */
function prdPayload(prd: Prd): string {
  return JSON.stringify({
    slug: prd.slug,
    title: prd.title,
    prompt: prd.prompt,
    markdown: prd.markdown
  });
}

/**
 * SHA-256 hex digest of the full Prd payload.
 */
function prdDigest(prd: Prd): string {
  return createHash('sha256').update(prdPayload(prd)).digest('hex');
}

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'prd.characterization.fixtures');

/**
 * Expected digests captured from pre-split app-builder/src/lib/prd.ts.
 * Regenerated only when intentionally changing generatePrd behavior (not during structure moves).
 */
/**
 * SHA-256 digests of JSON.stringify({slug,title,prompt,markdown}) captured from
 * pre-split `app-builder/src/lib/prd.ts` on 2026-07-24 (before the module split).
 * Full golden payloads live in `prd.characterization.fixtures/*.json`.
 */
const EXPECTED_DIGESTS: Readonly<Record<string, string>> = {
  'dashboard-auth-two-entities': '2e1cf0fa891e4dff36b8d6507bf69ff0bd3b5bf06415ac353f87159abf950f09',
  'mobile-no-auth-two-entities': '521d5747a9d7b8e459dc1cb5433e45470e0dab0eaae17d01b5c742e768e3aca3',
  'marketplace-auth-scoped': '22feff81fabd79d11f9f95add70ab65d8e258f5504521460aebebfb39a2996f2',
  'empty-entities-no-auth': '3fc8f4c486dd9688b872c83b6ae38ad3ca778cfac64f52fb3b1474845d1a91c3',
  'long-prompt-many-entities': '10a761700488daf7665b85c5addf55a5fb08b9fc53cb552fd419abe4179c0756'
};

describe('generatePrd characterization (byte-identical output)', () => {
  for (const c of CASES) {
    it(`matches golden output for ${c.id}`, () => {
      const prd = generatePrd(c.answers, c.cost);
      const payload = prdPayload(prd);
      const digest = prdDigest(prd);

      const fixturePath = join(fixturesDir, `${c.id}.json`);
      expect(existsSync(fixturePath), `missing fixture ${fixturePath}`).toBe(true);
      const golden = readFileSync(fixturePath, 'utf8');
      expect(payload).toBe(golden);
      expect(digest).toBe(EXPECTED_DIGESTS[c.id]);
    });
  }

  it('covers at least five varied inputs', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(5);
    const ids = new Set(CASES.map((c) => c.id));
    expect(ids.size).toBe(CASES.length);
  });
});
