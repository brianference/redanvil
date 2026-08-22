#!/usr/bin/env node
/**
 * The `prd` role: generate a PRD by DRIVING the deployed RedAnvil app-builder.
 *
 * The owner's standing instruction is that every app starts from a PRD produced
 * by https://redanvil.pages.dev/. There is no API shortcut -- /api/prd and
 * /api/generate are SPA fallback, returning the same HTML as a nonsense path,
 * and only /api/health answers JSON. So this drives the real wizard, which also
 * means every new app dogfoods the product.
 *
 * Writes docs/PRD.md and docs/prd-provenance.json. The provenance file exists
 * because a hand-written PRD is otherwise indistinguishable from a generated
 * one, and hand-writing it is exactly the shortcut this role prevents.
 *
 * Usage: node roles/prd.mjs --slug=sushi-finder --repoRoot=... --prompt="..."
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const BUILDER_URL = 'https://redanvil.pages.dev/';

/**
 * Parse `--key=value` arguments.
 * @param {string[]} argv raw args
 * @returns {Record<string,string>} parsed
 */
export function parseArgs(argv) {
  /** @type {Record<string,string>} */
  const out = {};
  for (const a of argv) {
    const m = /^--([^=]+)=([\s\S]*)$/.exec(a);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

/**
 * Rules that map a prompt to one option of a wizard group.
 *
 * WHY THIS REPLACED A STATIC PREFERENCE LIST. The old `PREFERRED` array was
 * tried in order against a FLAT list of every button on the page and clicked
 * exactly one. Two things followed, and both were silent:
 *
 *   1. `'Marketplace'` was the first entry, so EVERY app this pipeline ever
 *      built was typed a Marketplace no matter what was asked for. A dog-care
 *      reminder came back as `appType: "Marketplace"` whose problem statement
 *      read "users need to assign Reminder without double-booking".
 *   2. The builder renders all five groups on ONE form, not as a step sequence.
 *      Clicking one button answered app type and left sign-in, storage,
 *      realtime and integrations on their defaults forever.
 *
 * That is worse than a crash: every downstream role faithfully builds the wrong
 * product, and the gate passes it because nothing in the rubric knows what was
 * asked for. Answers are now derived from the prompt, per group, and every
 * choice is still recorded in provenance so the inputs stay auditable.
 *
 * Matching is by word boundary on a lowercased prompt. Order matters: the first
 * rule that hits wins, so the most specific signal is listed first.
 *
 * @type {Array<{group: RegExp, rules: Array<{option: string, test: RegExp}>, fallback: string}>}
 */
export const ANSWER_RULES = [
  {
    group: /app type/i,
    rules: [
      // More specific than Marketplace: "job application" / "job hunting" must
      // not lose to a stray "listing" in the same prompt. Job board sits AFTER
      // Marketplace so "it is not a marketplace, it is a job board" only picks
      // Job board when the marketplace hit is actually skipped as negated —
      // listing Job board first made that test green without any negation.
      { option: 'SaaS', test: /\b(job[- ]?(application|tracker|hunting|seeker)s?)\b/ },
      { option: 'Marketplace', test: /\b(marketplace|buyers?|sellers?|vendors?|listings?|commission)\b/ },
      { option: 'Job board', test: /\bjob[- ]?boards?\b/ },
      { option: 'API', test: /\b(api|endpoint|developers?|integration layer|webhook service)\b/ },
      { option: 'Internal tool', test: /\b(internal|admin|staff|back[- ]office|employees?|ops team)\b/ },
      { option: 'Mobile app', test: /\b(mobile|ios|android|phone app|on my phone)\b/ }
    ],
    // SaaS is the honest default for a full-stack web app: it is what the
    // enforced stack (Pages + Functions + D1) actually produces.
    fallback: 'SaaS'
  },
  {
    group: /sign-in|sign in|auth/i,
    rules: [
      {
        option: 'Yes',
        test: /\b(sign[- ]?in|log[- ]?in|account|accounts|per[- ]user|my own|private|personal|profile)\b/
      }
    ],
    fallback: 'No'
  },
  {
    group: /d1 tables|storage|data/i,
    rules: [
      { option: 'Relational + search', test: /\b(search|full[- ]text|filter|query|relations?|join)\b/ }
    ],
    fallback: 'Simple (D1 tables)'
  },
  {
    group: /live refresh|push-style|realtime|real-time/i,
    rules: [
      { option: 'Yes', test: /\b(real[- ]?time|live|push|instant|streaming|collaborat)\w*\b/ }
    ],
    fallback: 'No'
  }
];

/** Integration chips, each picked only when the prompt actually names it. */
export const INTEGRATION_RULES = [
  { option: 'Stripe', test: /\b(stripe|payments?|checkout|billing|subscriptions?)\b/ },
  { option: 'Email', test: /\b(e[- ]?mail|notify|notification|reminder|digest)\b/ },
  { option: 'SMS', test: /\b(sms|text message|texts?)\b/ },
  { option: 'Webhooks', test: /\b(webhooks?|callback)\b/ }
];

/**
 * Split a prompt into clauses on sentence boundaries and on `,` / `;`.
 * Matching is clause-scoped so a negated mention does not veto a genuine
 * positive mention in a different clause.
 *
 * @param {string} prompt raw prompt
 * @returns {string[]} lowercased clauses, empty strings dropped
 */
export function splitClauses(prompt) {
  return String(prompt)
    .toLowerCase()
    .split(/(?<=[.!?])\s+|[,;]\s*/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

/**
 * Whether a clause is under negation scope: `not a` / `is not` / `isn't` /
 * `never` / `no` / `rather than` / `instead of` / `not an` / `do(es) not`,
 * plus the "What this is NOT:" heading form (the heading itself and every
 * remaining clause of that sentence).
 *
 * @param {string} clause one clause, already lowercased
 * @param {boolean} [headingActive] true when this sentence opened with the NOT heading
 * @returns {boolean}
 */
export function clauseIsNegated(clause, headingActive = false) {
  if (headingActive) return true;
  return /(?:\b(?:is|was|are|were|do|does|did)\s+not\b|\b(?:isn't|aren't|wasn't|weren't|don't|doesn't|didn't|never)\b|\bnot an?\b|\brather than\b|\binstead of\b|\bno\b)/.test(
    clause
  );
}

/**
 * Clauses of a prompt with negation flags.
 *
 * A sentence containing `what this is not:` has every clause in that sentence
 * marked negated. Other sentences are flagged per-clause.
 *
 * @param {string} prompt raw prompt
 * @returns {Array<{text: string, negated: boolean}>}
 */
export function clausesWithNegation(prompt) {
  const sentences = String(prompt)
    .toLowerCase()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  /** @type {Array<{text: string, negated: boolean}>} */
  const out = [];
  for (const sentence of sentences) {
    const headingActive = /what this is not\s*:/.test(sentence);
    const parts = sentence
      .split(/[,;]\s*/)
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    for (const text of parts) {
      out.push({ text, negated: clauseIsNegated(text, headingActive) });
    }
  }
  return out;
}

/**
 * Whether `test` hits any NON-negated clause of the prompt.
 *
 * A match inside a negated clause supplies no positive evidence.
 *
 * @param {string} prompt raw prompt
 * @param {RegExp} test rule regex
 * @returns {boolean}
 */
export function ruleMatchesPrompt(prompt, test) {
  const clauses = clausesWithNegation(prompt);
  return clauses.some((c) => !c.negated && test.test(c.text));
}

/**
 * Derive which option(s) a wizard group should take from the prompt.
 *
 * @param {{label: string, options: string[]}} group one wizard group as read from the DOM
 * @param {string} prompt the app description
 * @returns {string[]} picks to click, possibly empty
 */
export function derivePicks(group, prompt) {
  const spec = ANSWER_RULES.find((r) => r.group.test(group.label));
  if (spec) {
    const matched = spec.rules.find(
      (r) => ruleMatchesPrompt(prompt, r.test) && group.options.includes(r.option)
    );
    const pick = matched?.option ?? spec.fallback;
    return group.options.includes(pick) ? [pick] : [];
  }
  if (group.options.some((o) => INTEGRATION_RULES.some((r) => r.option === o))) {
    /** @type {string[]} */
    const picks = [];
    for (const rule of INTEGRATION_RULES) {
      if (ruleMatchesPrompt(prompt, rule.test) && group.options.includes(rule.option)) {
        picks.push(rule.option);
      }
    }
    return picks;
  }
  return [];
}

/**
 * Thrown when the intended wizard answer is not the value the control holds.
 * The role must refuse to write a PRD in this case — recording the intended
 * answer while the document reflects something else is how a 46KB Marketplace
 * PRD shipped for a dog-care app.
 */
export class AnswerDidNotTakeError extends Error {
  /**
   * @param {string} group group label
   * @param {string} intended what we meant to select
   * @param {string} actual what the control actually holds
   */
  constructor(group, intended, actual) {
    super(
      `wizard answer did not take: ${group}: intended ${intended}, actual ${actual || '(none)'}`
    );
    this.name = 'AnswerDidNotTakeError';
    this.group = group;
    this.intended = intended;
    this.actual = actual;
  }
}

/**
 * Fail closed when the live control does not hold the intended value.
 *
 * @param {string} group group label
 * @param {string} intended intended option
 * @param {string} actual value read back from the DOM (empty if none selected)
 * @returns {void}
 * @throws {AnswerDidNotTakeError} when they differ
 */
export function assertAnswerTook(group, intended, actual) {
  if (intended !== actual) {
    throw new AnswerDidNotTakeError(group, intended, actual);
  }
}

/**
 * Write PRD.md and prd-provenance.json only after every intended answer is
 * confirmed as the value the control actually holds.
 *
 * @param {string} docsDir destination directory
 * @param {string} markdown generated PRD body
 * @param {string} prompt the prompt that produced it
 * @param {Array<{group: string, intended: string, actual: string}>} answers recorded answers
 * @param {string} source builder URL
 * @returns {void}
 * @throws {AnswerDidNotTakeError} when any answer did not take — and does not write
 */
export function writePrdArtifacts(docsDir, markdown, prompt, answers, source) {
  for (const a of answers) {
    assertAnswerTook(a.group, a.intended, a.actual);
  }
  if (markdown.length < 2000) {
    throw new Error(
      `wizard produced ${markdown.length} chars, below the 2000 floor -- refusing to write a stub PRD`
    );
  }
  mkdirSync(docsDir, { recursive: true });
  writeFileSync(join(docsDir, 'PRD.md'), markdown + '\n');
  writeFileSync(
    join(docsDir, 'prd-provenance.json'),
    JSON.stringify(
      {
        source,
        generatedBy: 'roles/prd.mjs driving the deployed wizard with Playwright',
        generatedAt: new Date().toISOString(),
        prompt,
        wizardAnswers: answers,
        characters: markdown.length
      },
      null,
      2
    ) + '\n'
  );
}

/**
 * Read the wizard's option groups straight from the DOM.
 *
 * Buttons are grouped by their shared parent element and labelled by walking
 * back to the nearest preceding text, which is how the builder actually marks
 * up each question -- verified by dumping the live page rather than assumed
 * from the component source.
 *
 * @param {import('playwright').Page} page the wizard page
 * @returns {Promise<Array<{label: string, options: string[]}>>} groups in DOM order
 */
async function readGroups(page) {
  return page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button')].filter((b) => {
      const t = (b.textContent || '').trim();
      return t && !/^(☾|☰|✕|Back|Next|Send description|Forge PRD)$/.test(t);
    });
    /** @type {Map<Element, string[]>} */
    const byParent = new Map();
    for (const b of buttons) {
      const parent = b.parentElement;
      if (!parent) continue;
      if (!byParent.has(parent)) byParent.set(parent, []);
      byParent.get(parent).push((b.textContent || '').trim());
    }
    return [...byParent.entries()].map(([parent, options]) => {
      let label = '';
      let el = parent.previousElementSibling;
      while (el && !label) {
        label = (el.textContent || '').trim();
        el = el.previousElementSibling;
      }
      return { label, options };
    });
  });
}

/**
 * Answer every group the wizard is showing, deriving each choice from the prompt.
 *
 * @param {import('playwright').Page} page the wizard page
 * @param {string} prompt the app description the whole build derives from
 * @param {string[]} chosen accumulator of recorded choices, for provenance
 * @returns {Promise<boolean>} whether anything was answered
 */
/**
 * Click `pick` inside the group at `groupIndex` and read back the value the
 * control actually holds. Waits on aria-pressed, never a fixed sleep.
 *
 * @param {import('playwright').Page} page the wizard page
 * @param {number} groupIndex index into collectGroupParents()
 * @param {string} pick intended option label
 * @returns {Promise<string>} the pressed option's label, or '' if none
 */
async function clickAndReadBack(page, groupIndex, pick) {
  const found = await page.evaluate(
    ({ groupIndex, pick }) => {
      const buttons = [...document.querySelectorAll('button')].filter((b) => {
        const t = (b.textContent || '').trim();
        return t && !/^(☾|☰|✕|Back|Next|Send description|Forge PRD)$/.test(t);
      });
      const parents = [];
      const seen = new Set();
      for (const b of buttons) {
        const parent = b.parentElement;
        if (!parent || seen.has(parent)) continue;
        seen.add(parent);
        parents.push(parent);
      }
      const parent = parents[groupIndex];
      if (!parent) return false;
      const btn = [...parent.querySelectorAll('button')].find(
        (b) => (b.textContent || '').trim() === pick
      );
      if (!btn) return false;
      btn.click();
      return true;
    },
    { groupIndex, pick }
  );

  if (!found) return '';

  try {
    await page.waitForFunction(
      ({ groupIndex, pick }) => {
        const buttons = [...document.querySelectorAll('button')].filter((b) => {
          const t = (b.textContent || '').trim();
          return t && !/^(☾|☰|✕|Back|Next|Send description|Forge PRD)$/.test(t);
        });
        const parents = [];
        const seen = new Set();
        for (const b of buttons) {
          const parent = b.parentElement;
          if (!parent || seen.has(parent)) continue;
          seen.add(parent);
          parents.push(parent);
        }
        const parent = parents[groupIndex];
        if (!parent) return false;
        const btn = [...parent.querySelectorAll('button')].find(
          (b) => (b.textContent || '').trim() === pick
        );
        return btn?.getAttribute('aria-pressed') === 'true';
      },
      { groupIndex, pick },
      { timeout: 5000 }
    );
  } catch {
    // Read whatever is actually pressed and let assertAnswerTook fail closed.
  }

  const pressed = await page.evaluate((groupIndex) => {
    const buttons = [...document.querySelectorAll('button')].filter((b) => {
      const t = (b.textContent || '').trim();
      return t && !/^(☾|☰|✕|Back|Next|Send description|Forge PRD)$/.test(t);
    });
    const parents = [];
    const seen = new Set();
    for (const b of buttons) {
      const parent = b.parentElement;
      if (!parent || seen.has(parent)) continue;
      seen.add(parent);
      parents.push(parent);
    }
    const parent = parents[groupIndex];
    if (!parent) return [];
    return [...parent.querySelectorAll('button')]
      .filter((b) => b.getAttribute('aria-pressed') === 'true')
      .map((b) => (b.textContent || '').trim());
  }, groupIndex);

  if (pressed.includes(pick)) return pick;
  return pressed[0] ?? '';
}

/**
 * Answer every group the wizard is showing, deriving each choice from the prompt.
 *
 * @param {import('playwright').Page} page the wizard page
 * @param {string} prompt the app description the whole build derives from
 * @param {Array<{group: string, intended: string, actual: string}>} chosen accumulator of recorded choices, for provenance
 * @returns {Promise<boolean>} whether anything was answered
 */
async function answerQuestion(page, prompt, chosen) {
  const groups = await readGroups(page);
  if (groups.length === 0) return false;
  let answered = false;

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const group = groups[groupIndex];
    const picks = derivePicks(group, prompt);

    for (const pick of picks) {
      const actual = await clickAndReadBack(page, groupIndex, pick);
      assertAnswerTook(group.label || 'group', pick, actual);
      chosen.push({
        group: group.label || 'group',
        intended: pick,
        actual
      });
      answered = true;
    }
  }
  return answered;
}

/**
 * Whether this file is the process entry point (Windows-safe).
 * @returns {boolean}
 */
function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(resolve(entry)).href;
  } catch {
    return false;
  }
}

/**
 * The prompt comes from the ENVIRONMENT first, and `--prompt` is only a
 * convenience for running this role by hand.
 *
 * Under n8n the prompt crossed TWO shell layers -- the Execute Command node runs
 * the outer command through a shell, and `role-run.mjs` then re-spawns the inner
 * command with `shell: true`. Each layer consumed a level of quoting, so
 *
 *   --prompt="A reminder app for dog owners that tracks..."
 *
 * arrived as
 *
 *   --prompt=A
 *
 * with every remaining word split off into its own argv entry. One character is
 * below the builder's 8-character minimum, so the Send button stayed disabled
 * forever and the role died on a 30s click timeout. The recorded `cmd` in
 * evidence/role-failures is what finally showed it.
 *
 * An environment variable crosses a shell boundary without being re-parsed, so
 * the text arrives whole no matter how many layers it passes through. Any value
 * carrying spaces or punctuation should travel this way rather than being
 * interpolated into a command string.
 */
/**
 * Decode a base64 prompt, returning '' rather than throwing on junk.
 * @param {string|undefined} value base64 text
 * @returns {string} the decoded prompt, or ''
 */
export function decodePromptB64(value) {
  if (!value) return '';
  try {
    return Buffer.from(String(value), 'base64').toString('utf8');
  } catch {
    return '';
  }
}

/**
 * Drive the deployed wizard and write the PRD. Exported so tests can import
 * the matchers without launching Playwright.
 *
 * @returns {Promise<void>}
 */
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const slug = args.slug;
  /**
   * The prompt, in order of trust: base64 argv, then the environment, then plain
   * `--prompt` for a hand-run.
   *
   * `--promptB64` is how the n8n path delivers it. The command string is parsed
   * by a shell TWICE -- Execute Command, then role-run's `shell: true` -- and each
   * pass ate a level of quoting, so a full sentence arrived as `--prompt=A`. One
   * character is below the builder's 8-character minimum, the Send button never
   * enabled, and the role died 30s later on a click timeout that looked like a
   * Playwright problem and was a quoting problem.
   *
   * Base64 has no spaces, quotes or shell metacharacters, so it crosses both
   * shells byte-for-byte. REDANVIL_PROMPT stays supported, but it cannot be the
   * only route: the n8n server's environment is fixed at boot, so a per-run prompt
   * from a webhook body has no way to reach a child process through it.
   */
  const prompt = decodePromptB64(args.promptB64) || process.env.REDANVIL_PROMPT || args.prompt;
  if (!slug || !prompt) {
    process.stderr.write('usage: prd.mjs --slug=X --prompt="..." [--repoRoot=.]\n');
    process.exit(2);
  }
  const repoRoot = resolve(args.repoRoot ?? process.cwd());
  const docsDir = join(repoRoot, slug, 'docs');

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 1000 });

  /** @type {Array<{group: string, intended: string, actual: string}>} */
  const chosen = [];
  await page.goto(BUILDER_URL, { waitUntil: 'networkidle' });

  try {
/**
 * Fill the composer, then WAIT FOR THE BUTTON TO ACTUALLY ENABLE before
 * clicking, re-filling if the value did not survive.
 *
 * This is a hydration race, and it is the reason the whole build failed under
 * n8n while the identical command succeeded from a shell. `networkidle` means
 * the network went quiet, NOT that React finished hydrating. When `fill()` lands
 * first, hydration re-renders the controlled textarea from its own empty initial
 * state and silently discards the text; the Send button is disabled while the
 * composer is empty, so it never enables and the click times out after 30s:
 *
 *   locator.click: Timeout 30000ms exceeded.
 *     waiting for getByRole('button', { name: /send description/i })
 *     57 x waiting for element to be visible, enabled and stable
 *
 * The element was always found. It was never *enabled*. Whoever runs this from a
 * warm shell wins the race and never sees it, which is exactly why it read as
 * "works locally, broken in n8n" rather than as a bug in the role.
 *
 * Bounded retries on a real signal, never a fixed sleep: re-fill and re-check
 * until the button reports enabled, then click.
 */
const composer = page.locator('#composer-prompt');
const sendButton = page.getByRole('button', { name: /send description/i });
await composer.waitFor({ state: 'visible' });

let composerReady = false;
for (let attempt = 0; attempt < 10 && !composerReady; attempt += 1) {
  await composer.fill(prompt);
  try {
    // Short per-attempt budget: if hydration ate the value, retrying costs a
    // second rather than the full 30s the bare click used to burn.
    await sendButton.waitFor({ state: 'visible', timeout: 3000 });
    composerReady = (await sendButton.isEnabled()) && (await composer.inputValue()) === prompt;
  } catch {
    composerReady = false;
  }
}

    if (!composerReady) {
      throw new Error(
        'the composer never accepted the prompt -- Send stayed disabled after 10 fills, ' +
          'so the app never received the description this build derives from'
      );
    }

await sendButton.click();

// Walk the question sequence. Bounded, because an unbounded loop against a
// wizard that stops advancing would hang the role rather than fail it.
let markdown = '';
for (let step = 0; step < 12; step += 1) {
  const done = await page
    .waitForFunction(
      () => /product requirements|## 1\.|# PRD/i.test(document.body.innerText),
      null,
      { timeout: 3000 }
    )
    .then(() => true)
    .catch(() => false);
  if (!done) {
    // Not the PRD yet — wait until option buttons or Next/Forge exist.
    await page
      .waitForFunction(
        () =>
          [...document.querySelectorAll('button')].some((b) => {
            const t = (b.textContent || '').trim();
            return /^(Next|Forge PRD)$/i.test(t) || (t && !/^(☾|☰|✕|Back|Send description)$/.test(t));
          }),
        null,
        { timeout: 5000 }
      )
      .catch(() => {});
  }
  if (done) {
    markdown = await page.evaluate(() => {
      const pre = document.querySelector('pre, article, [class*=prd], [class*=markdown]');
      return (pre?.textContent ?? document.body.innerText).trim();
    });

    // The wizard emits per-section specs, so the first H1 can be a SECTION
    // heading rather than the product. sushi-finder captured
    // "# Implementation Spec - By Photos" and the whole app shipped branded
    // "By Photos" -- header, footer, page title and footer blurb. Retitle to the
    // slug so a section name can never become the product name again.
    const slugTitle = slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    markdown = markdown.replace(/^#\s+.*$/m, `# ${slugTitle} — product requirements`);
    break;
  }
  const answered = await answerQuestion(page, prompt, chosen);

  // Submitting is now EXPLICIT. It used to happen by accident: the old
  // answer picker fell through to "the first button on the page", and on the
  // final step the only button left was "Forge PRD", so the form was submitted
  // by the same line that was supposed to be answering a question. Excluding
  // that button from the answer groups -- correct on its own terms, since it is
  // not an answer -- silently removed the only thing that pressed submit, and
  // the role produced 0 chars. Click it deliberately instead.
  const forge = page.getByRole('button', { name: /forge prd/i }).first();
  if (await forge.count()) {
    await forge.click().catch(() => {});
    continue;
  }

  const next = page.getByRole('button', { name: /^next$/i }).first();
  if (await next.count()) await next.click().catch(() => {});
    else if (!answered) break;
  }

    writePrdArtifacts(docsDir, markdown, prompt, chosen, BUILDER_URL);
    const summary = chosen.map((a) => `${a.group}: ${a.actual}`).join(', ');
    console.log(`PRD written: ${markdown.length} chars, wizard answers: ${summary || '(none)'}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

if (isDirectRun()) {
  void main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}
