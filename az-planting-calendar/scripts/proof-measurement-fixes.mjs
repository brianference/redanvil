/**
 * Prove the three measurement-script fixes without touching evidence/.
 *
 * (a) Touch floor is 44px and fails a 42×42 control that the old 40px gate passed.
 * (b) Canvas colour resolution handles color-mix / color(srgb) that hand-parsing misses.
 * (c) No waitForTimeout remains in the two measure scripts; theme wait uses painted signal.
 *
 * Exit 0 only if every assertion holds.
 */
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

/** Same constant as measure-header-build.mjs */
const MIN_TOUCH_TARGET_PX = 44;

/**
 * Touch-target checker matching the fixed measure-header-build logic.
 * @param {number} minTouchPx
 */
function collectTouchFails(minTouchPx) {
  const touchFails = [];
  for (const el of document.querySelectorAll(
    'button, a, input, select, [role="button"], [role="option"]'
  )) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.hasAttribute('hidden') || el.closest('[hidden]')) continue;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.height < minTouchPx || r.width < minTouchPx) {
      touchFails.push({
        id: el.id || null,
        tag: el.tagName,
        h: Math.round(r.height),
        w: Math.round(r.width)
      });
    }
  }
  return touchFails;
}

/**
 * OLD broken checker: outer 44 gate but only reported height < 40.
 * @param {number} outer
 * @param {number} reportFloor
 */
function collectTouchFailsOld(outer, reportFloor) {
  const touchFails = [];
  for (const el of document.querySelectorAll(
    'button, a, input, select, [role="button"], [role="option"]'
  )) {
    if (!(el instanceof HTMLElement)) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.height < outer || r.width < outer) {
      if (r.height < reportFloor) {
        touchFails.push({
          id: el.id || null,
          h: Math.round(r.height),
          w: Math.round(r.width)
        });
      }
    }
  }
  return touchFails;
}

/**
 * Hand-parser that only matches rgb()/rgba() integer forms (the banned approach).
 * @param {string} css
 */
function handParseIsDark(css) {
  const m = css.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!m) return false;
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luma < 40;
}

/**
 * Engine-resolved is-dark via canvas fillStyle + getImageData.
 * @param {string} css
 */
function canvasIsDark(css) {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('no canvas');
  ctx.fillStyle = 'rgb(1, 2, 3)';
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return { dark: luma < 40, r, g, b, luma, css };
}

const fixtureHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>measurement fix fixtures</title>
  <style>
    * { box-sizing: border-box; margin: 0; }
    body { font-family: system-ui, sans-serif; padding: 16px; }
    #small-42 {
      width: 42px; height: 42px; padding: 0; border: 0;
      background: #ccc; display: inline-block;
    }
    #ok-44 {
      width: 44px; height: 44px; padding: 0; border: 0;
      background: #8cf; display: inline-block;
    }
    #tiny-32 {
      width: 32px; height: 32px; padding: 0; border: 0;
      background: #f88; display: inline-block;
    }
    /* Formats the hand-parser cannot read */
    #srgb-dark {
      width: 80px; height: 80px;
      background-color: color(srgb 0.024 0.035 0.047);
    }
    #mix-dark {
      width: 80px; height: 80px;
      background-color: color-mix(in srgb, #000000 92%, #1a3040 8%);
    }
    #srgb-light {
      width: 80px; height: 80px;
      background-color: color(srgb 0.957 0.965 0.973);
    }
    #hex-dark {
      width: 80px; height: 80px;
      background-color: #06090c;
    }
    #hex-light {
      width: 80px; height: 80px;
      background-color: #f4f6f8;
    }
    /* Gradient: solid getComputedStyle.backgroundColor is transparent in some engines;
       we also set a solid fallback then override with gradient for the visual case. */
    #gradient-dark {
      width: 80px; height: 80px;
      background: linear-gradient(180deg, #05080b 0%, #0a1016 100%);
      background-color: #05080b;
    }
    :root[data-theme="light"] body { background: #eef1f4; color: #0e1419; }
    :root[data-theme="dark"] body { background: #0a0e12; color: #eef2f5; }
  </style>
</head>
<body>
  <button id="small-42" type="button">42</button>
  <button id="ok-44" type="button">44</button>
  <button id="tiny-32" type="button">32</button>
  <div id="srgb-dark" data-case="srgb-dark"></div>
  <div id="mix-dark" data-case="mix-dark"></div>
  <div id="srgb-light" data-case="srgb-light"></div>
  <div id="hex-dark" data-case="hex-dark"></div>
  <div id="hex-light" data-case="hex-light"></div>
  <div id="gradient-dark" data-case="gradient-dark"></div>
</body>
</html>`;

/**
 * Count waitForTimeout in a source file.
 * @param {string} rel
 */
function countFixedSleeps(rel) {
  const src = readFileSync(path.join(root, rel), 'utf8');
  const matches = src.match(/waitForTimeout\s*\(/g);
  return matches ? matches.length : 0;
}

/**
 * Assert and log.
 * @param {string} label
 * @param {boolean} ok
 * @param {string} detail
 */
function assert(label, ok, detail) {
  if (!ok) {
    console.error(`FAIL ${label}: ${detail}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS ${label}: ${detail}`);
}

async function main() {
  process.exitCode = 0;

  // --- (c) static: fixed sleeps removed from the two measure scripts ---
  const sleepChosen = countFixedSleeps('scripts/measure-chosen-design.mjs');
  const sleepHeader = countFixedSleeps('scripts/measure-header-build.mjs');
  assert(
    'c-sleep-count',
    sleepChosen === 0 && sleepHeader === 0,
    `measure-chosen-design waitForTimeout=${sleepChosen}, measure-header-build waitForTimeout=${sleepHeader} (found & removed: 1 in measure-chosen-design.mjs; 0 were in measure-header-build.mjs)`
  );

  const chosenSrc = readFileSync(path.join(root, 'scripts/measure-chosen-design.mjs'), 'utf8');
  assert(
    'c-viewport-before-theme',
    /viewport:\s*\{\s*width,\s*height\s*\}/.test(chosenSrc) &&
      /waitForThemePainted/.test(chosenSrc) &&
      !/waitForTimeout/.test(chosenSrc),
    'viewport set in newContext; waitForThemePainted present; no waitForTimeout'
  );

  const headerSrc = readFileSync(path.join(root, 'scripts/measure-header-build.mjs'), 'utf8');
  assert(
    'a-constant-44',
    /const MIN_TOUCH_TARGET_PX = 44/.test(headerSrc) &&
      !/height\s*<\s*40/.test(headerSrc) &&
      !/r\.height\s*<\s*40/.test(headerSrc),
    'MIN_TOUCH_TARGET_PX=44 present; no second 40px floor'
  );

  const themeSpec = readFileSync(path.join(root, 'tests/theme-evidence.spec.ts'), 'utf8');
  assert(
    'b-no-hand-parse',
    /samplePaintedSurface/.test(themeSpec) &&
      !/function isDarkRgb/.test(themeSpec) &&
      !/rgb\.match\(/.test(themeSpec),
    'theme-evidence uses samplePaintedSurface; isDarkRgb hand-parser gone'
  );

  // --- browser fixtures for (a) and (b) ---
  const server = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fixtureHtml);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = /** @type {import('node:net').AddressInfo} */ (server.address());
  const url = `http://127.0.0.1:${port}/`;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await page.goto(url, { waitUntil: 'load' });

  // (a) Touch targets
  const oldFails = await page.evaluate(
    ({ outer, reportFloor }) => {
      const touchFails = [];
      for (const el of document.querySelectorAll(
        'button, a, input, select, [role="button"], [role="option"]'
      )) {
        if (!(el instanceof HTMLElement)) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.height < outer || r.width < outer) {
          if (r.height < reportFloor) {
            touchFails.push({
              id: el.id || null,
              h: Math.round(r.height),
              w: Math.round(r.width)
            });
          }
        }
      }
      return touchFails;
    },
    { outer: 44, reportFloor: 40 }
  );
  const newFails = await page.evaluate((minTouchPx) => {
    const touchFails = [];
    for (const el of document.querySelectorAll(
      'button, a, input, select, [role="button"], [role="option"]'
    )) {
      if (!(el instanceof HTMLElement)) continue;
      if (el.hasAttribute('hidden') || el.closest('[hidden]')) continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.height < minTouchPx || r.width < minTouchPx) {
        touchFails.push({
          id: el.id || null,
          tag: el.tagName,
          h: Math.round(r.height),
          w: Math.round(r.width)
        });
      }
    }
    return touchFails;
  }, MIN_TOUCH_TARGET_PX);

  const oldIds = new Set(oldFails.map((f) => f.id));
  const newIds = new Set(newFails.map((f) => f.id));

  assert(
    'a-old-passed-42',
    !oldIds.has('small-42'),
    `old 40px report floor did NOT flag 42×42 (old fails: ${JSON.stringify(oldFails)})`
  );
  assert(
    'a-new-fails-42',
    newIds.has('small-42'),
    `new 44px floor flags 42×42 (new fails: ${JSON.stringify(newFails)})`
  );
  assert(
    'a-new-fails-32',
    newIds.has('tiny-32'),
    'new floor still flags 32×32'
  );
  assert(
    'a-new-passes-44',
    !newIds.has('ok-44'),
    '44×44 still passes under new floor'
  );
  assert(
    'a-exit-signal',
    newFails.length >= 2,
    `checker reports ${newFails.length} fails (>=2); non-zero fail set is the fail signal`
  );

  // (b) Colours — cases the hand-parser gets wrong
  const colourCases = await page.evaluate((ids) => {
    /** @type {Record<string, {css: string, hand: boolean, canvas: ReturnType<typeof canvasIsDark>}>} */
    const out = {};
    // inline the helpers (page.evaluate cannot close over Node functions as executable code
    // when they are only referenced by name after serialization of a different function).
    function handParseIsDark(css) {
      const m = css.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
      if (!m) return false;
      const r = Number(m[1]);
      const g = Number(m[2]);
      const b = Number(m[3]);
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return luma < 40;
    }
    function canvasResolve(css) {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('no canvas');
      ctx.fillStyle = 'rgb(1, 2, 3)';
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return { dark: luma < 40, r, g, b, luma, css };
    }
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el) continue;
      const css = getComputedStyle(el).backgroundColor;
      out[id] = { css, hand: handParseIsDark(css), canvas: canvasResolve(css) };
    }
    return out;
  }, ['srgb-dark', 'mix-dark', 'srgb-light', 'hex-dark', 'hex-light', 'gradient-dark']);

  console.log('colour resolution samples:', JSON.stringify(colourCases, null, 2));

  // hex still works for both (baseline)
  assert(
    'b-hex-dark',
    colourCases['hex-dark'].canvas.dark === true,
    `hex dark canvas dark=${colourCases['hex-dark'].canvas.dark} luma=${colourCases['hex-dark'].canvas.luma}`
  );
  assert(
    'b-hex-light',
    colourCases['hex-light'].canvas.dark === false,
    `hex light canvas dark=${colourCases['hex-light'].canvas.dark} luma=${colourCases['hex-light'].canvas.luma}`
  );

  // Modern formats: if engine exposes non-rgb() form, hand-parser fails open
  for (const id of ['srgb-dark', 'mix-dark', 'gradient-dark']) {
    const sample = colourCases[id];
    if (!sample) {
      assert(id, false, 'missing sample');
      continue;
    }
    const engineDark = sample.canvas.dark;
    assert(
      `b-${id}-canvas-dark`,
      engineDark === true,
      `canvas resolved dark=true (css=${sample.css}, luma=${sample.canvas.luma}, rgb=${sample.canvas.r},${sample.canvas.g},${sample.canvas.b})`
    );
    // Demonstrate hand-parser would be wrong when CSS is not rgb(integer,...)
    if (!/^rgba?\(\d+/i.test(sample.css)) {
      assert(
        `b-${id}-hand-wrong`,
        sample.hand === false && engineDark === true,
        `hand-parser said dark=${sample.hand} on non-rgb form "${sample.css}" while surface is dark`
      );
    } else {
      // Engine already resolved to rgb(); still prove canvas path works. Note the
      // hand-parser can luck into the right answer after resolution — the ban is
      // on writing the parser, not on rgb() existing.
      console.log(
        `NOTE ${id}: getComputedStyle already resolved to ${sample.css}; canvas still used (hand=${sample.hand})`
      );
    }
  }

  assert(
    'b-srgb-light-not-dark',
    colourCases['srgb-light'].canvas.dark === false,
    `srgb light canvas dark=${colourCases['srgb-light'].canvas.dark} luma=${colourCases['srgb-light'].canvas.luma}`
  );

  // Both themes: flip data-theme and resolve body background via canvas
  for (const theme of /** @type {const} */ (['light', 'dark'])) {
    await page.evaluate((t) => {
      document.documentElement.setAttribute('data-theme', t);
    }, theme);
    await page.waitForFunction((t) => {
      if (document.documentElement.getAttribute('data-theme') !== t) return false;
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return false;
      ctx.fillStyle = getComputedStyle(document.body).backgroundColor;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return t === 'dark' ? luma < 80 : luma >= 80;
    }, theme);
    const body = await page.evaluate(() => {
      const css = getComputedStyle(document.body).backgroundColor;
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('no canvas');
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return { css, r, g, b, luma, dark: luma < 80 };
    });
    assert(
      `b-theme-${theme}`,
      theme === 'dark' ? body.dark : !body.dark,
      `body under data-theme=${theme}: dark=${body.dark} luma=${body.luma} css=${body.css}`
    );
  }

  // (c) runtime: painted-state wait (no fixed sleep) yields stable light vs dark metrics
  async function applyThemeAndMeasure(theme) {
    await page.evaluate((t) => {
      document.documentElement.setAttribute('data-theme', t);
    }, theme);
    await page.waitForFunction((t) => {
      if (document.documentElement.getAttribute('data-theme') !== t) return false;
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return false;
      ctx.fillStyle = getComputedStyle(document.body).backgroundColor;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return t === 'dark' ? luma < 80 : luma >= 80;
    }, theme);
    return page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('no canvas');
      ctx.fillStyle = getComputedStyle(document.body).backgroundColor;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return {
        theme: document.documentElement.getAttribute('data-theme'),
        bodyLuma: 0.2126 * r + 0.7152 * g + 0.0722 * b,
        vw: window.innerWidth,
        vh: window.innerHeight
      };
    });
  }
  const lightMetrics = await applyThemeAndMeasure('light');
  const darkMetrics = await applyThemeAndMeasure('dark');
  assert(
    'c-theme-metrics-differ',
    lightMetrics.bodyLuma !== darkMetrics.bodyLuma &&
      lightMetrics.bodyLuma > 80 &&
      darkMetrics.bodyLuma < 80,
    `light luma=${lightMetrics.bodyLuma} dark luma=${darkMetrics.bodyLuma} (no fixed sleep)`
  );
  assert(
    'c-viewport-size',
    lightMetrics.vw === 375 && lightMetrics.vh === 812,
    `viewport held at 375×812 (got ${lightMetrics.vw}×${lightMetrics.vh})`
  );

  await browser.close();
  server.close();

  if (process.exitCode && process.exitCode !== 0) {
    console.error('\nproof-measurement-fixes: FAILED');
    process.exit(process.exitCode);
  }
  console.log('\nproof-measurement-fixes: ALL PASSED');
  console.log(
    JSON.stringify(
      {
        minTouchTargetPx: MIN_TOUCH_TARGET_PX,
        fixedSleepsFoundAndRemoved: {
          'measure-chosen-design.mjs': 1,
          'measure-header-build.mjs': 0
        },
        touchNewFails: newFails,
        colourCases
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
