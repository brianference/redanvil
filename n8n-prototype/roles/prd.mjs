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
import { chromium } from 'playwright';

const BUILDER_URL = 'https://redanvil.pages.dev/';

/**
 * Parse `--key=value` arguments.
 * @param {string[]} argv raw args
 * @returns {Record<string,string>} parsed
 */
function parseArgs(argv) {
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
const ANSWER_RULES = [
  {
    group: /app type/i,
    rules: [
      { option: 'Marketplace', test: /\b(marketplace|buyers?|sellers?|vendors?|listings?|commission)\b/ },
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
const INTEGRATION_RULES = [
  { option: 'Stripe', test: /\b(stripe|payments?|checkout|billing|subscriptions?)\b/ },
  { option: 'Email', test: /\b(e[- ]?mail|notify|notification|reminder|digest)\b/ },
  { option: 'SMS', test: /\b(sms|text message|texts?)\b/ },
  { option: 'Webhooks', test: /\b(webhooks?|callback)\b/ }
];

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
async function answerQuestion(page, prompt, chosen) {
  const groups = await readGroups(page);
  if (groups.length === 0) return false;
  const text = prompt.toLowerCase();
  let answered = false;

  for (const group of groups) {
    /** @type {string[]} */
    const picks = [];
    const spec = ANSWER_RULES.find((r) => r.group.test(group.label));

    if (spec) {
      const matched = spec.rules.find((r) => r.test.test(text) && group.options.includes(r.option));
      const pick = matched?.option ?? spec.fallback;
      if (group.options.includes(pick)) picks.push(pick);
    } else if (group.options.some((o) => INTEGRATION_RULES.some((r) => r.option === o))) {
      // Integrations are multi-select chips, so every match is clicked and a
      // prompt naming none of them correctly selects none.
      for (const rule of INTEGRATION_RULES) {
        if (rule.test.test(text) && group.options.includes(rule.option)) picks.push(rule.option);
      }
    }

    for (const pick of picks) {
      await page
        .getByRole('button', { name: pick, exact: true })
        .first()
        .click()
        .catch(() => {});
      chosen.push(`${group.label || 'group'}: ${pick}`);
      answered = true;
    }
  }
  return answered;
}

const args = parseArgs(process.argv.slice(2));
const slug = args.slug;
const prompt = args.prompt;
if (!slug || !prompt) {
  process.stderr.write('usage: prd.mjs --slug=X --prompt="..." [--repoRoot=.]\n');
  process.exit(2);
}
const repoRoot = resolve(args.repoRoot ?? process.cwd());
const docsDir = join(repoRoot, slug, 'docs');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 1000 });

/** @type {string[]} */
const chosen = [];
await page.goto(BUILDER_URL, { waitUntil: 'networkidle' });
await page.locator('#composer-prompt').fill(prompt);
await page.getByRole('button', { name: /send description/i }).click();

// Walk the question sequence. Bounded, because an unbounded loop against a
// wizard that stops advancing would hang the role rather than fail it.
let markdown = '';
for (let step = 0; step < 12; step += 1) {
  await page.waitForTimeout(1200);
  const done = await page.evaluate(() => /product requirements|## 1\.|# PRD/i.test(document.body.innerText));
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

await browser.close();

if (markdown.length < 2000) {
  process.stderr.write(
    `wizard produced ${markdown.length} chars, below the 2000 floor -- refusing to write a stub PRD\n`
  );
  process.exit(1);
}

mkdirSync(docsDir, { recursive: true });
writeFileSync(join(docsDir, 'PRD.md'), markdown + '\n');
writeFileSync(
  join(docsDir, 'prd-provenance.json'),
  JSON.stringify(
    {
      source: BUILDER_URL,
      generatedBy: 'roles/prd.mjs driving the deployed wizard with Playwright',
      generatedAt: new Date().toISOString(),
      prompt,
      wizardAnswers: chosen,
      characters: markdown.length
    },
    null,
    2
  ) + '\n'
);

console.log(`PRD written: ${markdown.length} chars, wizard answers: ${chosen.join(', ') || '(none)'}`);
