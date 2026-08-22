# Spec: the PRD role types the wrong product, and its provenance does not prove otherwise

## What happened, measured

A full build was run tonight with a prompt whose closing paragraph reads, verbatim:

> What this is NOT: it is not an applicant tracking system for employers, it is
> **not a marketplace**, it is not a resume builder, and it does not auto-apply
> to anything on the visitor's behalf.

`roles/prd.mjs` drove the live wizard and produced
`job-application-site/docs/PRD.md`, whose front matter is:

```yaml
appType: "Marketplace"
hasAuth: false
entities: ["Spreadsheet"]
slug: "real"
title: "Real"
```

The build was stopped at step 3 of 24. Twenty-one later roles would have built
that faithfully. This is bug #6's shape again -- a coherent, professional
document for the wrong product -- but NOT its cause: #6 was a static `PREFERRED`
list, and that fix is intact. Four separate defects are in evidence.

## Defect 1 -- the matcher reads a negation as an affirmation (root cause, confirmed)

`ANSWER_RULES` in `roles/prd.mjs` (around line 63) types the app with:

```js
{ option: 'Marketplace', test: /\b(marketplace|buyers?|sellers?|vendors?|listings?|commission)\b/ }
```

Two independent hits on this prompt:

1. `marketplace` -- matched inside **"it is not a marketplace"**. The sentence
   whose entire job is to rule the category out is what selected it.
2. `listings?` -- matched on "Do not fabricate listings" and "save a listing
   as an application", neither of which describes a marketplace. Observed in
   this run's own prompt and provenance, both quoted above.

Word-boundary keyword matching over a whole prompt cannot see negation, and a
prompt that carefully says what it is not is exactly the prompt this hurts most.

**Required:** before a rule's hit counts, the clause containing the match must
be checked for negation scope -- `not a`, `is not`, `isn't`, `never`, `no`,
`rather than`, `instead of`, `not an`, and the "What this is NOT:" heading form.
A match that falls inside a negated clause supplies NO positive evidence and
must not select that option. Do it by clause (split on sentence and on `,`/`;`),
not by whole prompt: one negated mention must not veto a genuine positive
mention elsewhere.

Do not solve this by deleting `listings?`. That treats one symptom of a general
defect and leaves every other rule negation-blind.

## Defect 2 -- provenance records the intended answer, not the resulting state

`docs/prd-provenance.json` for this run records:

```json
"wizardAnswers": ["App type: Marketplace", "Does this app need sign-in?: Yes", ...]
```

while the PRD it produced says `hasAuth: false`. **Those contradict.** The
provenance asserts sign-in was answered Yes and the generated document says
there is no auth, so at least one of them is not describing reality, and today
nothing in the run can tell you which.

**Required:** after answering, READ BACK the control's actual selected value
from the live DOM and record THAT, next to what was intended. Where they differ,
the role must fail loudly rather than write a PRD -- an answer that did not take
is exactly the class of failure that produced a 46KB document for a dog-care app
typed as a Marketplace. Wait on a real signal for the value, never a fixed
sleep, and never assume the click landed.

This may show the fault is in the DEPLOYED builder rather than in `prd.mjs`. If
so, say so with the captured evidence and stop -- do not guess at a fix for code
this task does not have in front of it.

## Defect 3 -- title and slug come out as "Real"

`title: "Real"` / `slug: "real"`, taken from "shows **real**, current job
openings". Same family as the documented bugs #8 and #10 (a phrase-shape
heuristic matching the wrong part of speech). The naming code is in the
app-builder workspace: `app-builder/src/lib/prd/naming.ts`, with
characterization coverage in `app-builder/src/lib/prd.characterization.test.ts`.

**Required:** a single leading adjective lifted out of the middle of a sentence
is not a product name. Fix the derivation, and regenerate the characterization
digests with the real generator -- NEVER hand-edit a digest to make a test pass.
A golden freezes a bug with exactly the authority it freezes a feature; if a
digest moves, the question is "is the new output right?".

## Defect 4 -- entities picks a non-domain noun

`entities: ["Spreadsheet"]`, from "Spreadsheets are what people actually use" --
a sentence about the thing the product REPLACES. Bug #10 is the same defect with
a different part of speech (`"Cleaned"`), and it is recorded as NOT fixed.
`deriveEntities` is the code path.

**Required:** an entity taken from a clause describing what the product replaces
or competes with is not a domain entity. If this cannot be made reliable, say so
plainly and leave it -- a wrong answer reported as fixed is worse than an open
bug.

## Tests -- each must be shown FAILING before it passes

The full prompt is at
`.redanvil/overnight/concept-job-application-site.txt` in the main repo; a copy
of the produced provenance is at `/tmp/prd-provenance.json`. Use the REAL prompt
text, not a paraphrase.

1. The derivation given this exact prompt does NOT return `Marketplace`.
2. A prompt reading `A marketplace for buyers and sellers` still DOES return
   `Marketplace` -- the negation fix must not break the positive case.
3. `it is not a marketplace, it is a job board` returns the job-board answer,
   proving clause scoping rather than whole-prompt vetoing.
4. The sign-in group returns `Yes` for this prompt.
5. A read-back mismatch between intended and actual makes the role FAIL rather
   than write a PRD.

For each, produce the input that makes it fail and read the real exit code.
State honestly which of defects 3 and 4 you fixed and which you did not.

## Constraints

- Do not commit, stage, push, deploy, or run any git command.
- Node ESM `.mjs` for the role; the app-builder is TypeScript.
- JSDoc on every function. No new dependencies.
- Read every file before editing it.
