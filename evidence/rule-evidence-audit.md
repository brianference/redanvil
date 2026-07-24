# Per-rule evidence audit — app-builder gate 41/41

Generated at commit `e07c56f`. Every scored rule below is backed by a re-runnable check, a judge verdict citing file:line, or a measured visual verdict whose evidence exists on disk. Anti-hallucination method: the 19 deterministic checks were re-run fresh (all exit 0); every verdict's evidence files were confirmed present.

| Rule | Sev | Method | How to reproduce the verdict |
|------|-----|--------|------------------------------|
| u-typing-strict | blocker | det | `node orchestrator/scripts/checks/check.mjs u-typing-strict app-builder` (or the tsc/eslint/vitest command); exit 0 |
| u-typing-no-any | blocker | det | `node orchestrator/scripts/checks/check.mjs u-typing-no-any app-builder` (or the tsc/eslint/vitest command); exit 0 |
| u-conc-dead-code | blocker | det | `node orchestrator/scripts/checks/check.mjs u-conc-dead-code app-builder` (or the tsc/eslint/vitest command); exit 0 |
| u-test-presence | blocker | det | `node orchestrator/scripts/checks/check.mjs u-test-presence app-builder` (or the tsc/eslint/vitest command); exit 0 |
| hyg-env-ignored | blocker | det | `node orchestrator/scripts/checks/check.mjs hyg-env-ignored app-builder` (or the tsc/eslint/vitest command); exit 0 |
| u-typing-scoped-ignores | major | det | `node orchestrator/scripts/checks/check.mjs u-typing-scoped-ignores app-builder` (or the tsc/eslint/vitest command); exit 0 |
| u-sec-param-sql | blocker | det | `node orchestrator/scripts/checks/check.mjs u-sec-param-sql app-builder` (or the tsc/eslint/vitest command); exit 0 |
| u-sec-no-stub-paths | blocker | det | `node orchestrator/scripts/checks/check.mjs u-sec-no-stub-paths app-builder` (or the tsc/eslint/vitest command); exit 0 |
| u-sec-headers-cors | major | det | `node orchestrator/scripts/checks/check.mjs u-sec-headers-cors app-builder` (or the tsc/eslint/vitest command); exit 0 |
| u-val-input-validation | blocker | det | `node orchestrator/scripts/checks/check.mjs u-val-input-validation app-builder` (or the tsc/eslint/vitest command); exit 0 |
| fe-theme-tokens-only | blocker | det | `node orchestrator/scripts/checks/check.mjs fe-theme-tokens-only app-builder` (or the tsc/eslint/vitest command); exit 0 |
| fe-no-unsanitized-html | blocker | det | `node orchestrator/scripts/checks/check.mjs fe-no-unsanitized-html app-builder` (or the tsc/eslint/vitest command); exit 0 |
| fe-i18n-central-copy | blocker | det | `node orchestrator/scripts/checks/check.mjs fe-i18n-central-copy app-builder` (or the tsc/eslint/vitest command); exit 0 |
| hyg-no-binaries | blocker | det | `node orchestrator/scripts/checks/check.mjs hyg-no-binaries app-builder` (or the tsc/eslint/vitest command); exit 0 |
| hyg-secret-scan | blocker | det | `node orchestrator/scripts/checks/check.mjs hyg-secret-scan app-builder` (or the tsc/eslint/vitest command); exit 0 |
| u-sec-sast | major | det | `node orchestrator/scripts/checks/check.mjs u-sec-sast app-builder` (or the tsc/eslint/vitest command); exit 0 |
| u-plat-worker-runtime | blocker | det | `node orchestrator/scripts/checks/check.mjs u-plat-worker-runtime app-builder` (or the tsc/eslint/vitest command); exit 0 |
| u-conc-no-padding | major | det | `node orchestrator/scripts/checks/check.mjs u-conc-no-padding app-builder` (or the tsc/eslint/vitest command); exit 0 |
| hyg-no-duplication | blocker | det | `node orchestrator/scripts/checks/check.mjs hyg-no-duplication app-builder` (or the tsc/eslint/vitest command); exit 0 |
| fe-light-dark | blocker | visual | visual verdict, evidence: `evidence/screenshots/ab-375-dark.png`, `evidence/screenshots/ab-375-light.png` |
| fe-responsive-375 | blocker | visual | visual verdict, evidence: `evidence/screenshots/ab-375-dark.png`, `evidence/screenshots/ab-375-light.png` |
| fe-no-attribution | blocker | visual | visual verdict, evidence: `evidence/screenshots/ab-1280-light.png` |
| fe-required-pages | blocker | visual | visual verdict, evidence: `evidence/screenshots/ab-1280-light.png` |
| fe-premium-nav | blocker | visual | visual verdict, evidence: `evidence/screenshots/ab-1280-light.png`, `evidence/screenshots/db-1280-dark.png` |
| fe-touch-targets | blocker | visual | visual verdict, evidence: `evidence/screenshots/ab-1280-light.png` |
| fe-type-floor | blocker | visual | visual verdict, evidence: `evidence/screenshots/ab-1280-light.png` |
| fe-product-completeness | blocker | visual | visual verdict, evidence: `evidence/traces/e2e-app-builder.zip`, `evidence/screenshots/ab-1280-light.png` |
| fe-visual-review-recorded | blocker | visual | visual verdict, evidence: `evidence/screenshots/ab-375-dark.png`, `evidence/screenshots/ab-375-light.png`… |
| fe-a11y-contrast | blocker | visual | visual verdict, evidence: `evidence/axe/app-builder-dark.json`, `evidence/axe/app-builder-light.json`… |
| fe-cross-link | major | visual | visual verdict, evidence: `evidence/screenshots/ab-contact.png` |
| fe-noncolor-state | major | visual | visual verdict, evidence: `evidence/screenshots/db-1280-dark.png` |
| fe-safe-areas | major | visual | visual verdict, evidence: `evidence/screenshots/ab-375-dark.png` |
| fe-seo-og | major | visual | visual verdict, evidence: `evidence/screenshots/ab-contact.png` |
| u-conc-idiomatic | major | judge | judge verdict, evidence: `app-builder/src/lib/prd.ts`, `app-builder/src/lib/job.ts`… |
| u-conc-no-speculative-abstraction | major | judge | judge verdict, evidence: `app-builder/src/lib/abortableEffect.ts`, `app-builder/src/lib/useAbortableJsonGet.ts`… |
| u-conc-use-what-exists | major | judge | judge verdict, evidence: `app-builder/package.json`, `app-builder/functions/api/submit.ts`… |
| u-conc-smallest-diff | major | judge | judge verdict, evidence: `app-builder/src/lib/abortableEffect.ts`, `app-builder/src/lib/useAbortableJsonGet.ts`… |
| u-test-adequacy | major | judge | judge verdict, evidence: `app-builder/src/lib/estimate.test.ts`, `app-builder/src/lib/job.test.ts`… |
| u-test-behavioral | major | judge | judge verdict, evidence: `app-builder/src/lib/savePrd.test.ts`, `app-builder/functions/api/jobs.test.ts`… |
| fe-pages-compose | major | judge | judge verdict, evidence: `app-builder/src/pages/Home.tsx`, `app-builder/src/pages/About.tsx`… |
| fe-fail-closed-states | major | judge | judge verdict, evidence: `app-builder/src/pages/Saved.tsx`, `app-builder/src/pages/SavedPrd.tsx`… |

## Verification commands

```
# reproduce the whole score, rule by rule:
npm run gate -- app-builder --threshold 90 --judge evidence/verdicts-app-builder.json --na ci,process
# CI reproduces it independently and compares per-rule:
node .github/scripts/verify_results.mjs app-builder results/app-builder.json evidence/verdicts-app-builder.json ci,process
```
