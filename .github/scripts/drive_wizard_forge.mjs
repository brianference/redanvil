/**
 * Single shared driver for the app-builder core flow:
 * chat composer → clarifying wizard → Forge PRD → visible PRD result.
 *
 * Locators and step order match e2e_smoke_app_builder.mjs (role/label based,
 * wait on real signals). Product-judgement harnesses (qa_visual, user_refuse)
 * MUST call this — do not invent a second way to exercise the wizard.
 *
 * @module drive_wizard_forge
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/**
 * Default forge prompt — long enough for MIN_PROMPT_LENGTH, same domain
 * shape as e2e_smoke_app_builder (plain-language product description).
 */
export const DEFAULT_FORGE_PROMPT =
  'an app to remind you when your dogs ears need cleaned, teeth cleaned, groomed, vet appointments etc';

/**
 * @typedef {{
 *   submitOk: boolean,
 *   submitStatus: number | null,
 *   prdVisible: boolean,
 *   downloadVisible: boolean,
 *   error: string | null
 * }} WizardForgeResult
 */

/**
 * Drive chat → wizard → Forge PRD on an already-loaded app-builder page.
 *
 * Fail closed: any step that does not complete leaves prdVisible false.
 * Callers must treat that as a product failure (exit 1), never as "measured fine".
 *
 * @param {import('playwright').Page} page - Page already at the app home URL.
 * @param {{ prompt?: string, submitTimeoutMs?: number, resultTimeoutMs?: number }} [opts]
 * @returns {Promise<WizardForgeResult>}
 */
export async function driveWizardForge(page, opts = {}) {
  const prompt = (opts.prompt ?? DEFAULT_FORGE_PROMPT).trim();
  const submitTimeoutMs = opts.submitTimeoutMs ?? 20_000;
  const resultTimeoutMs = opts.resultTimeoutMs ?? 20_000;

  if (prompt.length < 8) {
    return {
      submitOk: false,
      submitStatus: null,
      prdVisible: false,
      downloadVisible: false,
      error: 'forge prompt too short (need at least 8 characters)'
    };
  }

  try {
    // 1. Describe the app in the chat composer, then send (both by role).
    //    Same as e2e_smoke_app_builder: textbox role, not getByLabel — form and
    //    textarea share "Describe your app".
    await page.getByRole('textbox', { name: /describe your app/i }).fill(prompt);
    await page.getByRole('button', { name: /send description/i }).click();

    // 2. Scope step: default app type is already chosen; Next is enabled.
    const next = page.getByRole('button', { name: /^next$/i });
    await next.waitFor({ state: 'visible', timeout: resultTimeoutMs });
    if (!(await next.isEnabled())) {
      // Re-pick Mobile app if defaults were cleared somehow.
      const mobileChip = page.getByRole('button', { name: /^mobile app$/i });
      if ((await mobileChip.count()) > 0) await mobileChip.click();
    }
    if (!(await next.isEnabled())) {
      return {
        submitOk: false,
        submitStatus: null,
        prdVisible: false,
        downloadVisible: false,
        error: 'wizard Next stayed disabled on the Scope step'
      };
    }
    await next.click();

    // 3. Features step: at least one feature must be selected.
    const featureBoxes = page.locator('input[type=checkbox]');
    await featureBoxes.first().waitFor({ state: 'visible', timeout: resultTimeoutMs });
    const featureCount = await featureBoxes.count();
    if (featureCount === 0) {
      return {
        submitOk: false,
        submitStatus: null,
        prdVisible: false,
        downloadVisible: false,
        error: 'features step showed no suggestions'
      };
    }
    let anyChecked = false;
    for (let i = 0; i < featureCount; i += 1) {
      if (await featureBoxes.nth(i).isChecked()) {
        anyChecked = true;
        break;
      }
    }
    if (!anyChecked) await featureBoxes.first().check();
    if (!(await next.isEnabled())) {
      return {
        submitOk: false,
        submitStatus: null,
        prdVisible: false,
        downloadVisible: false,
        error: 'wizard Next stayed disabled on the Features step'
      };
    }
    await next.click();

    // 4. Forge the PRD; wait on the real network signal (POST /api/submit).
    const forge = page.getByRole('button', { name: /forge prd/i });
    await forge.waitFor({ state: 'visible', timeout: resultTimeoutMs });

    let submitStatus = null;
    let submitOk = false;
    try {
      const [submit] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes('/api/submit') && r.request().method() === 'POST',
          { timeout: submitTimeoutMs }
        ),
        forge.click()
      ]);
      submitStatus = submit.status();
      submitOk = submit.ok();
    } catch (err) {
      return {
        submitOk: false,
        submitStatus: null,
        prdVisible: false,
        downloadVisible: false,
        error: `forge submit did not complete: ${err instanceof Error ? err.message : String(err)}`
      };
    }

    if (!submitOk) {
      return {
        submitOk: false,
        submitStatus,
        prdVisible: false,
        downloadVisible: false,
        error: `POST /api/submit returned ${submitStatus}, expected 2xx`
      };
    }

    // 5. PRD output must actually render (download control and/or instrumented region).
    const download = page
      .getByRole('link', { name: /download \.md/i })
      .or(page.getByRole('button', { name: /download \.md/i }));
    const prdRegion = page.getByTestId('prd-result');

    let downloadVisible = false;
    try {
      await download.first().waitFor({ state: 'visible', timeout: resultTimeoutMs });
      downloadVisible = true;
    } catch {
      downloadVisible = false;
    }

    let regionVisible = false;
    if ((await prdRegion.count()) > 0) {
      try {
        await prdRegion.first().waitFor({ state: 'visible', timeout: 3_000 });
        regionVisible = true;
      } catch {
        regionVisible = false;
      }
    }

    const prdVisible = downloadVisible || regionVisible;
    return {
      submitOk: true,
      submitStatus,
      prdVisible,
      downloadVisible,
      error: prdVisible ? null : 'submit succeeded but no PRD result was visible'
    };
  } catch (err) {
    return {
      submitOk: false,
      submitStatus: null,
      prdVisible: false,
      downloadVisible: false,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

/**
 * Whether Playwright is available (same pattern as other harnesses).
 *
 * @returns {typeof import('playwright') | null}
 */
export function tryLoadPlaywright() {
  try {
    return require('playwright');
  } catch {
    return null;
  }
}
