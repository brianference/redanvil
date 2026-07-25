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

| `--na` lane | rules removed | guarded before |
|---|---|---|
| frontend | 22 (every visual blocker) | no |
| security | 9 | no |
| concision | 7 | no |
| hygiene | 5 | no |
| typing | 3 | no |
| testing | 3 | no |
| ci | 4 | yes |
| process | 2 | n/a |

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

## Still open

### 4. The judge tier almost never dissents
24 verdicts across both apps, 19 judge-method. Two commits in the repo's history recorded a
judge FAIL; every current verdict passes. That is not proof of rubber-stamping — the code may
simply be clean — but a tier that has dissented twice in its lifetime provides weak signal, and
nothing measures its dissent rate. Worth instrumenting before trusting it further.

### 5. A scaffolded app is never gated end-to-end in CI
Zero references to the scaffold in `ci.yml`. The scaffold is verified by unit tests and by a
local probe, and the pipeline simulation runs `check.mjs` rules against it — but no CI job takes
a freshly scaffolded app through the real `gateApp`. The product's core promise is "generated
apps clear the gate", and CI never demonstrates it.

### 6. Coverage is disclosed but not floored
Gate reports carry coverage (87% and 84%) and it is honest, but nothing fails when it drops. A
run could waive its way to 40% coverage and still print 100/100 beside it. A `--min-coverage`
floor exists as an idea in the second audit and was never implemented.

### 7. `hyg-no-duplication` is still exact-match within one app
The cross-app pass normalises identifiers; the per-app rule does not, so a rename still defeats
it inside a single app. The two now disagree about what duplication means.

### 8. The design audit measures the home route only
`design_audit.mjs` checks touch targets, type floor and overflow on `/` alone. A regression on
`/saved` or a wizard step would not be caught. Required pages are status-checked but not
measured for the mobile rules.

### 9. `proc-pr-title-ticket` is still N/A on this machine
Unchanged from the second audit: `gh` is not on PATH, so it always returns N/A. It fails closed,
so it is honest, but it has never once been measured here.

### 10. Nothing checks that the deployed bundle matches the gated commit
The gate scores a working tree; the deploy verification compares an asset hash to a local build.
Neither ties the SCORED commit to the DEPLOYED artifact. A green result and a stale production
build can coexist silently — the same class as the stale verdict, one layer out.
