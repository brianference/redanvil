#!/usr/bin/env node
/**
 * Capture a deployed app's account screens at three widths in both themes.
 *
 * The point of this script is to produce PNGs a human (or a model that can view
 * images) actually OPENS. Reading a component and concluding what it renders is
 * the failure this exists to prevent: it passed a page whose hero stayed black
 * in light mode, because an attribute-flip check cannot see paint.
 *
 * Theme is set with Playwright's colorScheme emulation AND a reload, because a
 * theme read at first paint does not re-run on an emulation change alone.
 *
 * Usage:
 *   node shots.mjs --url https://sushi-finder.pages.dev --out ./shots/sushi \
 *     --paths /,/signin,/signup,/account
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const opt = (f, d = null) => {
  const i = args.indexOf(f)
  return i === -1 ? d : args[i + 1]
}

const url = opt('--url')
const out = opt('--out', './shots')
const paths = (opt('--paths', '/') || '/').split(',').map((p) => p.trim()).filter(Boolean)
// Apps do not agree on this. RedAnvil's shared theme module uses `theme`;
// trip-one uses `trip-one-theme`. Seeding the wrong key means BOTH runs capture
// the light page and the dark screenshots are a lie, which is exactly what
// happened before this flag existed.
const themeKey = opt('--theme-key', 'theme')

if (!url) {
  console.error('--url is required')
  process.exit(2)
}

const WIDTHS = [375, 768, 1280]
const THEMES = ['light', 'dark']

mkdirSync(out, { recursive: true })

const browser = await chromium.launch()
const findings = []
const painted_by = new Map() // `${path}|${width}|${theme}` -> bodyBg
let consoleErrors = 0

for (const theme of THEMES) {
  for (const width of WIDTHS) {
    const context = await browser.newContext({
      viewport: { width, height: width < 500 ? 812 : 900 },
      colorScheme: theme,
      deviceScaleFactor: 1,
    })

    // colorScheme emulation ALONE does not flip these apps. RedAnvil's shared
    // theme module gives a cold visitor LIGHT whatever the OS says (an enforced
    // standard, recorded in cold_visitor.mjs), and writes an explicit
    // data-theme. Emulating dark and screenshotting therefore captured the LIGHT
    // page and labelled it dark -- a measurement wrong in the flattering
    // direction. Seed the stored preference the app actually reads, then assert
    // below that the attribute really landed.
    await context.addInitScript(
      ({ mode, key }) => {
        try {
          localStorage.setItem(key, mode)
        } catch {
          /* private mode: the paint comparison below will catch the miss */
        }
      },
      { mode: theme, key: themeKey },
    )

    const page = await context.newPage()

    const errors = []
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
    page.on('pageerror', (e) => errors.push(String(e)))

    for (const path of paths) {
      const target = url.replace(/\/$/, '') + path
      const slug = (path === '/' ? 'home' : path.replace(/^\//, '').replace(/[/?=&]/g, '-'))
      const name = `${slug}-${theme}-${width}.png`
      try {
        const res = await page.goto(target, { waitUntil: 'networkidle', timeout: 45000 })
        // Reload so any theme read at first paint re-runs under the emulated scheme.
        await page.reload({ waitUntil: 'networkidle', timeout: 45000 })

        // Measure what is actually painted, not what a class name implies.
        const painted = await page.evaluate(() => {
          const bodyBg = getComputedStyle(document.body).backgroundColor
          const htmlBg = getComputedStyle(document.documentElement).backgroundColor
          const doc = document.documentElement
          // What the viewer ACTUALLY sees. Some apps paint the page background on
          // <html> and leave <body> transparent (pet-sitter does). Reading body
          // alone reported rgba(0,0,0,0) for both themes and produced a false
          // "theme did not change" failure on an app whose theme worked fine.
          const transparent = (c) => !c || c === 'rgba(0, 0, 0, 0)' || c === 'transparent'
          const effectiveBg = transparent(bodyBg) ? htmlBg : bodyBg
          return {
            bodyBg,
            htmlBg,
            effectiveBg,
            dataTheme: doc.getAttribute('data-theme'),
            scrollW: doc.scrollWidth,
            clientW: doc.clientWidth,
            title: document.title,
          }
        })

        // Fail loudly when the page did not actually adopt the theme being
        // captured, instead of silently filing a light screenshot under "dark".
        if (painted.dataTheme && painted.dataTheme !== theme) {
          findings.push(
            `THEME NOT APPLIED ${path} ${width}px: asked for ${theme}, page rendered data-theme="${painted.dataTheme}"`,
          )
        }

        painted_by.set(`${path}|${width}|${theme}`, painted.effectiveBg)

        const overflows = painted.scrollW > painted.clientW + 1
        if (overflows) {
          findings.push(`HORIZONTAL OVERFLOW ${path} ${theme} ${width}px: scrollWidth ${painted.scrollW} > clientWidth ${painted.clientW}`)
        }

        await page.screenshot({ path: join(out, name), fullPage: true })
        console.log(
          `  ${name.padEnd(34)} status=${res?.status()} bg=${painted.effectiveBg} theme=${painted.dataTheme ?? '(none)'}${overflows ? '  OVERFLOW' : ''}`,
        )
      } catch (err) {
        findings.push(`FAILED ${path} ${theme} ${width}px: ${String(err).slice(0, 160)}`)
        console.log(`  ${name.padEnd(34)} ERROR ${String(err).slice(0, 100)}`)
      }
    }

    if (errors.length) {
      consoleErrors += errors.length
      findings.push(`CONSOLE ERRORS ${theme} ${width}px: ${errors.slice(0, 3).join(' | ').slice(0, 300)}`)
    }
    await context.close()
  }
}

await browser.close()

// The check that cannot be fooled by a missing attribute or the wrong storage
// key: if the light and dark runs painted the SAME background, dark mode was
// never applied and every "dark" screenshot is really the light page.
for (const path of paths) {
  for (const width of WIDTHS) {
    const light = painted_by.get(`${path}|${width}|light`)
    const dark = painted_by.get(`${path}|${width}|dark`)
    if (light && dark && light === dark) {
      findings.push(
        `THEME DID NOT CHANGE ${path} ${width}px: light and dark both painted ${light}. ` +
          `The "dark" screenshots are the light page. Wrong --theme-key (currently "${themeKey}"), or the app has no dark mode.`,
      )
    }
  }
}

writeFileSync(join(out, 'findings.txt'), findings.join('\n') || 'none', 'utf8')
console.log(`\nconsole errors: ${consoleErrors}`)
console.log(`findings: ${findings.length}`)
for (const f of findings) console.log('  - ' + f)
console.log(`\nPNGs in ${out} -- OPEN THEM. A captured screenshot nobody looked at proves nothing.`)
