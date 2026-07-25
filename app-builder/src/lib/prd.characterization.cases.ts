/**
 * Characterization inputs for generatePrd, shared by the test and the
 * regeneration script.
 *
 * They live here rather than inside the test so the script that rewrites the
 * goldens provably uses the SAME inputs the test asserts against. Duplicating
 * them would let the two drift, and a golden generated from different inputs
 * than the test replays is worse than no golden.
 */
import { createHash } from 'node:crypto';
import { estimate } from './estimate';
import { type Prd, type TokenEstimate } from './prd';
import type { WizardAnswers } from './job';

export const CASES: ReadonlyArray<{
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
 *
 * @param prd - Generated PRD.
 * @returns Canonical JSON string used for both the fixture and the digest.
 */
export function prdPayload(prd: Prd): string {
  return JSON.stringify({
    slug: prd.slug,
    title: prd.title,
    prompt: prd.prompt,
    markdown: prd.markdown
  });
}

/**
 * SHA-256 hex digest of the full Prd payload.
 *
 * @param prd - Generated PRD.
 * @returns Hex digest.
 */
export function prdDigest(prd: Prd): string {
  return createHash('sha256').update(prdPayload(prd)).digest('hex');
}
