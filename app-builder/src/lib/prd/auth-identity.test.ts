import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { estimate } from '../estimate';
import { generatePrd } from './generate';
import { deriveEntities } from './naming';
import {
  authRequiredByFeatures,
  buildFeatures,
  defaultSelectedFeatureIds
} from './sections/features';
import { extractSubject } from './sections/capabilities';

/**
 * Overnight prompt that produced hasAuth: false with Accounts at F8, and
 * feature names headed by "ones they sent". Read from disk so a paraphrase
 * cannot silently replace the measured input.
 */
const JOB_APPLICATION_PROMPT = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    '..',
    '..',
    '.redanvil',
    'overnight',
    'concept-job-application-site.txt'
  ),
  'utf8'
);

/** Pronouns the spec names as illegal heads of an entity or feature subject. */
const PRONOUN_HEADS = new Set([
  'ones',
  'one',
  'those',
  'them',
  'it',
  'they',
  'which',
  'anyone',
  'anybody',
  'someone',
  'somebody',
  'everyone',
  'everybody',
  'nobody',
  'you'
]);

/**
 * Whether a phrase is unusable as a domain noun: after dropping leading
 * determiners, a remaining word is a pronoun (`ones they sent`, `them`,
 * a bare `those`). `those listings` keeps listings.
 *
 * @param phrase - Entity, subject, or feature-name residue.
 * @returns True when a pronoun remains as a content word.
 */
function hasPronounHead(phrase: string): boolean {
  const words = phrase
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const determiners = new Set(['a', 'an', 'the', 'this', 'that', 'these', 'those', 'which']);
  while (words.length > 1 && determiners.has(words[0]!)) {
    words.shift();
  }
  if (words.length === 0) return true;
  return words.some((word) => PRONOUN_HEADS.has(word));
}

/**
 * Strip the verb/template prefix and trailing view-word from a feature name
 * so the domain phrase is what is checked for a pronoun head.
 *
 * @param name - Feature title from buildFeatures.
 * @returns Domain phrase, or the original name when no prefix matches.
 */
function featureDomainPhrase(name: string): string {
  return name
    .replace(
      /^(Search and filter|Filter and sort|Ask the assistant about|Browse & search|Import and export|Alerts for|Search|Filter|Schedule|Compute|Manage)\s+/i,
      ''
    )
    .replace(/\s+(grid|detail|history|totals)$/i, '')
    .trim();
}

/**
 * Pull the yaml frontmatter block from a generated PRD.
 *
 * @param markdown - Full PRD markdown.
 * @returns Fence body, or empty string.
 */
function yamlFrontmatter(markdown: string): string {
  return markdown.match(/```yaml\n([\s\S]*?)\n```/)?.[1] ?? '';
}

describe('auth-identity spec', () => {
  describe('1. authRequiredByFeatures with accounts at a non-F3 id', () => {
    it('returns true when the accounts feature is present and is not F3', () => {
      // Measured: capability features numbered Accounts to F8. Identity by
      // id === 'F3' && name === 'Accounts' returned false and dropped auth.
      const entities = deriveEntities(JOB_APPLICATION_PROMPT);
      const features = buildFeatures(entities, true, JOB_APPLICATION_PROMPT);
      const accounts = features.find((f) => /PBKDF2/.test(f.behavior));
      expect(accounts, 'accounts feature missing from derivation').toBeDefined();
      expect(accounts!.id, 'accounts must not be identified by sitting at F3').not.toBe('F3');
      expect(accounts!.role).toBe('accounts');
      expect(authRequiredByFeatures(true, features)).toBe(true);
    });
  });

  describe('2. wizardHasAuth false stays false', () => {
    it('returns false when wizardHasAuth is false, whatever is selected', () => {
      const entities = deriveEntities(JOB_APPLICATION_PROMPT);
      const withAccounts = buildFeatures(entities, true, JOB_APPLICATION_PROMPT);
      const withoutAccounts = buildFeatures(entities, false, JOB_APPLICATION_PROMPT);
      expect(authRequiredByFeatures(false, withAccounts)).toBe(false);
      expect(authRequiredByFeatures(false, withoutAccounts)).toBe(false);
      expect(authRequiredByFeatures(false, [])).toBe(false);
    });
  });

  describe('3. full generate on the real overnight prompt', () => {
    it('does not emit hasAuth: false or the fully-public sentence when sign-in was Yes', () => {
      const entities = deriveEntities(JOB_APPLICATION_PROMPT);
      const selected = defaultSelectedFeatureIds(entities, true, JOB_APPLICATION_PROMPT);
      const prd = generatePrd(
        {
          prompt: JOB_APPLICATION_PROMPT,
          appType: 'SaaS',
          hasAuth: true,
          entities: '',
          selectedFeatureIds: selected
        },
        estimate({ features: 8, hasAuth: true, entities: Math.max(entities.length, 1) })
      );
      const yaml = yamlFrontmatter(prd.markdown);
      expect(yaml).toMatch(/hasAuth: true/);
      expect(yaml).not.toMatch(/hasAuth: false/);
      expect(prd.markdown).not.toContain(
        'The product is fully public — no register/login, no session middleware, no user-owned scoping.'
      );
    });
  });

  describe('4. no pronoun-headed entity or feature subject', () => {
    it('rejects pronoun heads on the real prompt and on other pronoun phrases', () => {
      const entities = deriveEntities(JOB_APPLICATION_PROMPT);
      expect(entities.length).toBeGreaterThan(0);
      for (const entity of entities) {
        expect(hasPronounHead(entity), `entity "${entity}" has a pronoun head`).toBe(false);
      }
      const features = buildFeatures(entities, true, JOB_APPLICATION_PROMPT);
      for (const feature of features) {
        const domain = featureDomainPhrase(feature.name);
        expect(
          hasPronounHead(domain),
          `feature "${feature.name}" domain "${domain}" has a pronoun head`
        ).toBe(false);
      }

      // Same family, different wording — a literal "ones they sent" skip would miss these.
      const themSubject = extractSubject(
        'someone loses track of them after the tab is closed',
        ['Application']
      );
      expect(hasPronounHead(themSubject), `subject "${themSubject}"`).toBe(false);
      const thoseSubject = extractSubject('track those they filed last season', ['Filing']);
      expect(hasPronounHead(thoseSubject), `subject "${thoseSubject}"`).toBe(false);
      const onesEntities = deriveEntities(
        'a tracker of ones they filed last week and ones they filed this week'
      );
      for (const entity of onesEntities) {
        expect(hasPronounHead(entity), `derived "${entity}"`).toBe(false);
      }
    });

    it('still accepts a determiner + domain noun (those listings)', () => {
      const entities = deriveEntities('A catalog that tracks those listings for a shop');
      expect(entities.map((e) => e.toLowerCase())).toEqual(expect.arrayContaining(['listing']));
      const subject = extractSubject('search those listings by title', ['Listing']);
      expect(hasPronounHead(subject)).toBe(false);
      expect(subject.toLowerCase()).toMatch(/listing/);
    });
  });

  describe('5. negative control: public app with sign-in No', () => {
    it('still produces hasAuth: false when the wizard answered No', () => {
      // Same public reminder prompt the suite already uses as a hasAuth:false
      // document. Selection is active so this is the same path that dropped
      // a Yes; here the answer is No and must stay false.
      const prompt =
        'an app to remind you when your dog needs grooming, vet visits, ear cleaning';
      const entities = ['Reminder', 'Pet'];
      const selected = defaultSelectedFeatureIds(entities, false, prompt);
      const prd = generatePrd(
        {
          prompt,
          appType: 'Mobile app',
          hasAuth: false,
          entities: entities.join(', '),
          selectedFeatureIds: selected
        },
        estimate({ features: 3, hasAuth: false, entities: entities.length })
      );
      const yaml = yamlFrontmatter(prd.markdown);
      expect(yaml).toMatch(/hasAuth: false/);
      expect(yaml).not.toMatch(/hasAuth: true/);
      expect(prd.markdown).toContain(
        'The product is fully public — no register/login, no session middleware, no user-owned scoping.'
      );
    });
  });
});
