# Third audit

Measured against `8a67ce9`, after both earlier audits' twenty findings were closed. Every claim
here was checked against the repo or the live site.

The first two audits asked "what does the corpus claim that nothing measures?" That question is
now largely answered. This one asks a sharper version: **of the things we do measure, how many
does the gate actually check, and how much can a single flag remove?**

---

## 1. Twelve of fifteen visual rules rested on a prose note — CLOSED

Fifteen rubric rules have method `visual`. Only three (`fe-a11y-contrast`,
`fe-product-completeness`, `fe-desktop-width`) were backed by a machine report the verdict parser
could inspect. The other twelve passed on a hand-typed sentence.

The sharp part: most of those twelve **were** being measured — in throwaway scripts, whose
numbers were then retyped into the note. The measurement existed; the evidence chain did not, so
nothing stopped the number and the claim drifting apart. That is the same failure as the first
audit's stale verdicts, one level in.

**Fixed.** `.github/scripts/design_audit.mjs` measures all twelve on the rendered page and writes
one report per app. A passing verdict must cite a report in which THAT rule is `ok`; a report
that measures the app but not the rule is rejected, and so is one recording a failure. Both apps
measure 12/12. `drift.yml` runs it daily.

## 2. A lane waiver removed up to 22 rules with nothing looking — CLOSED

The second audit closed individual-rule waivers. Lane waivers were left open, and they are the
wider lever:

| `--na` lane | rules removed             | guarded before |
| ----------- | ------------------------- | -------------- |
| frontend    | 22 (every visual blocker) | no             |
| security    | 9                         | no             |
| concision   | 7                         | no             |
| hygiene     | 5                         | no             |
| typing      | 3                         | no             |
| testing     | 3                         | no             |
| ci          | 4                         | yes            |
| process     | 2                         | n/a            |

Measured: 50 of 55 rules, including 31 blockers, were removable by a flag with no reality check.

**Fixed.** A lane is now waivable only when its subject is genuinely absent — `frontend` needs no
rendered components, the universal lanes need no source at all. `process` remains the one
deliberate exception: it describes how a change was made, which the app directory cannot decide.

## 3. Re-stamping a verdict was not re-measuring it — CLOSED

Found by falling into it. Adding the Features step broke the e2e flow; re-stamping the verdicts
carried a **passing** e2e report from before the change onto the new commit. Freshness passed
because neither the verdicts file nor the report file had moved — only reality had.

**Fixed.** A cited report must now be produced at or after the commit it vouches for, with a
minute of slack for the normal write-then-commit ordering. This immediately forced a full
re-measurement, which is the correct behaviour.

---

## Findings 4-10

### 4. The judge tier has NEVER dissented — CLOSED (an independent judge was run, and it disagreed)

Now instrumented, and the number is worse than this audit first estimated. I wrote that "two
commits recorded a judge FAIL". `judge_dissent.mjs` reads every revision of both verdict files
out of git history and measures:

|                                  | count                       |
| -------------------------------- | --------------------------- |
| verdict-file revisions inspected | 34                          |
| distinct judge verdicts          | **258**                     |
| judge FAILs ever recorded        | **0**                       |
| distinct visual verdicts         | 399                         |
| visual FAILs ever recorded       | 2 (both `fe-a11y-contrast`) |

The two historical failures were VISUAL, not judge. The judge tier has never once said no, in
258 recorded opportunities. It contributes up to 30% of tier-2 weight on that record.

This is deliberately **not** wired as a blocking check with a floor of 1. The honest response to
"the judge never disagrees" is to publish the number, not to manufacture a disagreement so a
check goes green. The script defaults to report-only and runs daily; raise the floor to 1 once
the tier has genuinely rejected something.

The real fix is upstream: judge verdicts are currently written by the same agent that wrote the
code. An independent reviewer with no stake in the diff is the thing missing, and no amount of
scoring fixes that.

**Closed by doing it.** The same ten judge-method rules were handed to a reviewer running in a
disposable worktree, with a fresh context, no access to the verdict file it was re-deciding, and
an instruction to cite `file:line` evidence. It returned **six FAILs**.

Each claim was then checked rather than accepted:

| rule                                | verdict | outcome                                                                                                                                                                                                                                |
| ----------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `u-conc-no-speculative-abstraction` | FAIL    | confirmed — `isFeatureContinueBlocked` had zero production callers; `contentColumnStyle` was an empty object kept only as a `style=` prop                                                                                              |
| `u-conc-smallest-diff`              | FAIL    | confirmed — `SavedPrd` kept `maxWidth: 46rem` inline and the wizard form `40rem`, both after the desktop-width work moved layout to classes everywhere else                                                                            |
| `u-test-adequacy`                   | FAIL    | confirmed — `resolveFeatureSelection` was re-exported "for unit tests" that did not exist, and `canForgePrd`'s empty-selection branch had no assertion                                                                                 |
| `u-test-behavioral`                 | FAIL    | confirmed — the Features gate tests asserted a test-only dual, so the production predicate was never under test                                                                                                                        |
| `fe-pages-compose`                  | FAIL    | confirmed — `Saved.tsx` was 403 lines inlining a toolbar, KPI strip, card list, a local `KpiCard` and ~20 style objects                                                                                                                |
| `u-conc-idiomatic`                  | FAIL    | **partly refuted** — it described `generatePrd` as a 270-line function with a duplicated prompt string at lines 289-295 and 302-308. The function is 185 lines and those lines are markdown template body. The file-size half was real |

Five confirmed defects, all fixed. One claim was wrong and is recorded as wrong — a judge that is
never contradicted is the failure mode this finding is about, and that applies to the independent
one too.

`judge_dissent.mjs` now reports the two populations separately and prints the gap:
**self-recorded 0.0%, independent 60.0%**. They are deliberately not averaged; averaging would
hide the asymmetry, which is the whole finding. The report lives at
`evidence/judge-independent-app-builder.json` with per-rule adjudication.

### 5. A scaffolded app is never gated end-to-end in CI — CLOSED

`gate_scaffold.mjs` scaffolds a real job, installs it, and runs the tool-backed checks (tsc,
eslint, vitest, build) plus every static rule `check.mjs` implements — 27 rules run, 8 correctly
not applicable to a fresh scaffold. Wired into CI. It also refuses to run if rule extraction
returns an implausibly small list, because a check that silently measures nothing while printing
PASS is worse than no check: the first version did exactly that (0 rules run, still PASS).

Visual and judge rules are deliberately out of scope here — they need a rendered review.

### 6. Coverage is disclosed but not floored — CLOSED

`--min-coverage` makes the denominator a gate. Proven both ways: 85 passes at the current 87%,
95 fails with the reason. Both apps now run with a floor (85 and 80).

### 7. `hyg-no-duplication` is still exact-match within one app — CLOSED

The in-app check now imports `normaliseSource` / `isMostlyStyleProps` from the cross-app pass, so
there is one definition of "the same code" rather than two.

Unifying them immediately exposed a defect in the shared definition, which is the more
interesting half. Identifier normalisation is lossy on purpose — it is what catches a renamed
copy — but it flattens

```
interface Props { onClose: () => void }
export function Header({ a, b, c }: Props): JSX.Element {
```

into pure punctuation, which every component in both apps matches. Multi-line import bodies
survived the import filter too, and a module specifier is a real string literal, so a block of
nothing but imports looked substantive. Both were being counted as duplicated code.

`isDeclarationSkeleton` now recognises lines whose only surviving words are declaration keywords,
a block needs two lines of real content to count, and whole import statements are dropped rather
than only their first line. Cross-app total **646 → 393**. That is a measurement correction, not
deduplication: the source did not change, the number was wrong.

The stricter definition then found real copy-paste that exact matching had been blind to, because
each copy had renamed something — one wizard step union declared three times under three names,
two identical validation banners, two identical loading/error banners, two hand-inlined copies of
`messageFromPayload`, two hand-rolled parse-and-validate preambles, and three copies of the same
dashboard test fixture. Removing those took it to **387**, which is the ratchet now. Three tests
pin the corrected definition so it cannot silently regress.

### 8. The design audit measures the home route only — CLOSED

The mobile pass now runs on every route, not just `/`, and it immediately found real 14px text on
five of them (`Saved`, `LegalPage`, both `Breadcrumbs`, the dashboard's `ContentSections`). All
fixed to the token scale.

Fixing my own measurement mattered as much: the first version counted inline prose links as tap
targets and reported a confident FAIL for correct markup. WCAG 2.5.8 exempts a target "in a
sentence or block of text", and the check now honours that. An over-strict measurement is as
wrong as a lenient one.

It also found two defects nothing else would have. Pointing it at `/templates` — a route that
turns out not to exist — showed that an unmatched URL rendered an **empty document**: no header,
no heading, no way back. Both apps now ship a `NotFound` page and the audit deliberately measures
a bad route so that failure cannot return. The dashboard's first 404 CTA then failed the
touch-target check at 24px, correctly, because a standalone button is not covered by the
inline-text exemption.

One defect still needed a human: the footer lockup renders a 440x149 raster with the tagline
baked into the pixels, and at 48px the tagline came out about five pixels tall and read as a grey
smear. No measurement flags that. It took looking at the screenshot, which is why
`screenshots.mjs` now produces the review set deterministically — a review that happened leaves
an artifact, and one that did not is obvious.

### 9. `proc-pr-title-ticket` is still N/A on this machine

Unchanged from the second audit: `gh` is not on PATH, so it always returns N/A. It fails closed,
so it is honest, but it has never once been measured here.

### 10. Nothing checks that the deployed bundle matches the gated commit — CLOSED

`verify_deployed.mjs` compares what production serves against the build of the scored commit,
and refuses a result produced from a dirty tree (which describes no commit at all). It caught
exactly that on its first run. Runs daily in `drift.yml` for both apps.

A first version required `HEAD == scoredCommit`, which is wrong — committing the result file
itself moves HEAD. It now fails only when files under the app directory changed between the
scored commit and HEAD, which is the condition that actually breaks attribution.
