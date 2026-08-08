/**
 * Measure WCAG AA on each palette file with axe-core (both themes on page).
 * Never hand-compute contrast — axe-core is the source of truth.
 */
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Resolve axe from monorepo root or local
let axeSource;
const candidates = [
  join(__dirname, '../../../node_modules/axe-core/axe.min.js'),
  join(__dirname, '../../../../node_modules/axe-core/axe.min.js'),
  join(__dirname, '../../node_modules/axe-core/axe.min.js'),
];
for (const c of candidates) {
  try {
    axeSource = readFileSync(c, 'utf8');
    console.log('axe-core from', c);
    break;
  } catch {
    /* try next */
  }
}
if (!axeSource) {
  try {
    const axePath = require.resolve('axe-core/axe.min.js');
    axeSource = readFileSync(axePath, 'utf8');
    console.log('axe-core from', axePath);
  } catch (err) {
    console.error('Could not load axe-core', err);
    process.exit(1);
  }
}

const FILES = [
  'palette-01.html',
  'palette-02.html',
  'palette-03.html',
  'palette-04.html',
  'palette-05.html',
];

/**
 * @param {import('playwright').Page} page
 * @param {string} filePath
 */
async function runAxe(page, filePath) {
  const url = pathToFileURL(filePath).href;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.addScriptTag({ content: axeSource });
  /** @type {{ violations: Array<{ id: string, impact: string | null, description: string, nodes: Array<{ target: string[], failureSummary?: string }> }>, passes: Array<{ id: string }> }} */
  const results = await page.evaluate(async () => {
    // @ts-expect-error axe injected
    return await window.axe.run(document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
      },
    });
  });
  return results;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    colorScheme: 'light',
  });
  const page = await context.newPage();

  /** @type {Record<string, { url: string, violationCount: number, passCount: number, violations: Array<{ id: string, impact: string | null, description: string, targets: string[] }>, criticalRules: { colorContrast: 'pass' | 'fail', linkName: string } }>} */
  const report = {};
  let totalViolations = 0;

  for (const file of FILES) {
    const filePath = join(__dirname, file);
    console.log('measuring', file, '…');
    const results = await runAxe(page, filePath);
    const violations = results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      targets: v.nodes.flatMap((n) => n.target),
    }));
    const colorContrast = results.violations.some((v) => v.id === 'color-contrast')
      ? 'fail'
      : 'pass';
    report[file] = {
      url: pathToFileURL(filePath).href,
      violationCount: results.violations.length,
      passCount: results.passes.length,
      violations,
      criticalRules: {
        colorContrast,
        linkName: results.violations.some((v) => v.id === 'link-name') ? 'fail' : 'pass',
      },
    };
    totalViolations += results.violations.length;
    console.log(
      `  violations=${results.violations.length} color-contrast=${colorContrast} passes=${results.passes.length}`,
    );
    if (violations.length) {
      for (const v of violations) {
        console.log(`  - ${v.id} (${v.impact}): ${v.description}`);
        console.log(`    targets: ${v.targets.slice(0, 4).join(', ')}`);
      }
    }
  }

  await browser.close();

  const out = {
    tool: 'axe-core',
    engine: 'chromium',
    measuredAt: new Date().toISOString(),
    scope: 'Each palette HTML includes light AND dark phone themes of the same Photos grid screen. axe-core run against the full document (both themes simultaneously).',
    totalViolations,
    files: report,
  };

  const outPath = join(__dirname, 'axe-results.json');
  writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
  console.log('wrote', outPath);
  console.log('TOTAL_VIOLATIONS', totalViolations);
  process.exit(totalViolations > 0 ? 2 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
