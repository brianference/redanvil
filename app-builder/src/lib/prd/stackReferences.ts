/**
 * Official documentation for the stack a generated PRD prescribes.
 *
 * The architecture section (sections/architecture.ts) pins every build to the
 * same platform, so a saved PRD's detail page can point the reader at the real
 * docs for what it asks them to use. Only technologies the PRD text actually
 * names are listed; a PRD that names none gets no references, never a padded list.
 *
 * Every URL returned 200 to a browser user-agent on 2026-09-24. fe-resource-links
 * re-probes them on each gate run, so a moved page fails the gate rather than
 * shipping a dead citation.
 */

/** One documentation link for a technology named in a PRD. */
export interface StackReference {
  /** Product name as the PRD writes it. */
  readonly name: string;
  /** Official documentation URL. */
  readonly url: string;
}

/** Name, docs URL, and the pattern that proves the PRD names it. */
interface StackReferenceRule extends StackReference {
  readonly mentions: RegExp;
}

const STACK_REFERENCE_RULES: readonly StackReferenceRule[] = [
  { name: 'Cloudflare Pages', url: 'https://developers.cloudflare.com/pages/', mentions: /\bCloudflare Pages\b/ },
  {
    name: 'Pages Functions',
    url: 'https://developers.cloudflare.com/pages/functions/',
    mentions: /\bPages Functions\b/
  },
  { name: 'Cloudflare D1', url: 'https://developers.cloudflare.com/d1/', mentions: /\bD1\b/ },
  { name: 'Zod', url: 'https://zod.dev/', mentions: /\bZod\b/ },
  {
    name: 'Web Crypto API',
    url: 'https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API',
    mentions: /\bWeb Crypto\b/
  },
  { name: 'Vite', url: 'https://vite.dev/guide/', mentions: /\bVite\b/ },
  { name: 'React', url: 'https://react.dev/', mentions: /\bReact\b/ },
  { name: 'Playwright', url: 'https://playwright.dev/docs/intro', mentions: /\bPlaywright\b/ }
];

/**
 * Documentation links for the technologies a PRD names, in stack order.
 *
 * @param markdown - Saved PRD markdown.
 * @returns References for named technologies only; empty when none are named.
 */
export function stackReferencesFor(markdown: string): StackReference[] {
  return STACK_REFERENCE_RULES.filter((rule) => rule.mentions.test(markdown)).map(({ name, url }) => ({
    name,
    url
  }));
}
