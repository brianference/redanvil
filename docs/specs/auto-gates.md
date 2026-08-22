# Spec: unattended resolution of the four human gates

## Why

`build-workflow.mjs` generates a `n8n-nodes-base.wait` node with `resume: form`
for every step whose `humanGate` is true. There are four: `logo`, `palette`,
`layout`, `decide`. Unattended, a full build reaches `logo` (step 6 of 24) and
suspends there until a person taps a Telegram link.

Tonight's run has no person. The unknown being tested tonight is whether 24 steps
chain at all, not whether the palette is good, so the gates must resolve
themselves -- while recording every choice AND the alternatives not taken, so the
owner can re-run the design steps with real choices afterwards.

This must be OPT-IN and OFF by default. A gate that silently stops being a gate
is worse than no gate.

## Deliverable 1 -- `n8n-prototype/roles/auto-decide.mjs`

A new deterministic role runner. Usage:

    node n8n-prototype/roles/auto-decide.mjs --axis=logo --slug=X --repoRoot=Y

`--axis` is one of `logo`, `palette`, `layout`. Argument parsing must follow the
existing convention in `roles/decide.mjs` (`--name=value` only). Exit 2 on bad
usage.

Per axis, the target file and the marker token it must produce:

| axis | DECISION.md | token | candidate source on disk |
|---|---|---|---|
| logo | `design-refs/logos/DECISION.md` | `CHOSEN` | `design-refs/logos/*.png` |
| palette | `design-refs/palettes/DECISION.md` | `CHOSEN` | ids named in `design-refs/palettes/gallery.html` |
| layout | `design-refs/design-options/DECISION.md` | `DECIDED` | `design-refs/design-options/*.html` minus `gallery.html` |

Behaviour:

1. ENUMERATE REAL CANDIDATES FROM DISK. Never from the prose of DECISION.md
   alone, and never from a hardcoded list. A candidate id must correspond to a
   file (or, for palette, a token that literally occurs in `gallery.html`).
2. IF ZERO CANDIDATES EXIST, EXIT 1 with a message naming the directory it
   looked in. This is the check that must be able to fail: an auto-resolver that
   invents `mark-01` when no logo was ever generated would let 18 later steps
   build on a decision about nothing. Do not create the DECISION.md if it is
   absent -- exit 1.
3. PICK DETERMINISTICALLY. If the existing DECISION.md contains a line matching
   `/recommend|suggest|strongest|lead/i` that names one of the enumerated
   candidate ids, take that id. Otherwise take the first candidate in sorted
   order. No randomness -- `Math.random()` and time-derived choice are both
   forbidden, because a re-run must reproduce the same pick.
4. IF THE FILE ALREADY CARRIES A REAL `<TOKEN>: <value>` LINE (same regex shape
   as `decide.mjs` uses: `\*{0,2}TOKEN\*{0,2}\s*:\s*\S+`), leave it alone and
   exit 0 reporting that a decision already existed. An owner's real choice must
   never be overwritten by the auto-resolver.
5. APPEND (never rewrite) a block to the DECISION.md:

        ## AUTO-RESOLVED <ISO timestamp> -- pending owner review

        <TOKEN>: <chosen-id>

        Resolved without an owner because the run was unattended. This is a
        provisional pick, not a preference.

        - Chosen: <chosen-id> -- <why: recommendation line, or first in sorted order>
        - Alternatives not taken: <id>, <id>, ...
        - To override: re-run the `<axis>` step and record a real choice.

   Appending matters: `process-map.mjs` requires the logo DECISION.md to still
   contain `mark-05` and the palette one to still contain `palette-05` and
   `dark`. Rewriting the file would destroy those and fail the step contract.
6. FOR `logo` ONLY: copy the chosen mark's `.png` over
   `<slug>/public/brand-mark.png`, creating `public/` if needed. The `logo` step
   contract requires that file at >= 2000 bytes. `design-role.mjs` already has a
   provisional-copy path around line 178-215 -- READ IT FIRST and stay
   consistent with it; do not duplicate its logic if it can be reused.
7. WRITE `<slug>/evidence/auto-gate-decisions.json`, merging with any existing
   content so three axes accumulate rather than overwrite each other. Shape:

        { "axis": { "chosen": "...", "alternatives": [...], "reason": "...",
                    "resolvedAt": "...", "provisional": true } }

8. Print one summary line to stdout.

## Deliverable 2 -- opt-in generation in `build-workflow.mjs`

When `process.env.REDANVIL_AUTO_GATES` is `'1'` or `'true'`:

- For `logo`, `palette` and `layout`: emit, INSTEAD of the Wait node, a params
  Code node plus a `Role:` executeWorkflow node in exactly the shape
  `paramsNode`/`roleNode` already produce, with
  `cmd = node n8n-prototype/roles/auto-decide.mjs --axis=<id> --slug={slug} --repoRoot={root}`
  and `artifacts` set to `<slug>/<the axis DECISION.md path>`. Reusing the role
  sub-workflow is deliberate: it already refuses a step whose artifact did not
  change, so a silently-failed auto-resolve cannot pass as a decision.
  Name them `auto-<id> params` and `Role: auto-<id>` so they cannot collide with
  a real step's node names.
- For `decide`: drop the Wait node only. The three axes are already recorded by
  then, and `roles/decide.mjs` verifies them. Nothing extra to run.
- Keep the Telegram notify node in all four cases, but when auto gates are on
  its text must say the decision was auto-resolved and is pending review, not
  that a decision is needed. It must still be `onError: 'continueRegularOutput'`.
- Print the mode in the generator's existing summary output.

When the env var is unset, the generated JSON must be BYTE-IDENTICAL to what is
generated today. Prove it: run the generator with the var unset and confirm
`git diff --exit-code n8n-prototype/workflows/redanvil-full-build.json` is clean.

## Deliverable 3 -- a test that can fail

Add tests next to the project's existing n8n-prototype tests (find where they
live; do not invent a new framework). Required cases:

1. `auto-decide.mjs` EXITS NON-ZERO on a fixture whose design-refs directory is
   empty. Assert the exit code and that no DECISION.md was created. This is the
   known-bad case -- run it and read the real exit code before claiming it works.
2. A fixture with three real candidate files gets a `CHOSEN: <id>` line whose id
   is one of those three, and the alternatives list names the other two.
3. A fixture that ALREADY has `CHOSEN: mark-02` is left unmodified (compare file
   bytes before and after).
4. The generator with `REDANVIL_AUTO_GATES` unset produces zero diff.

## Constraints

- Node ESM `.mjs`, matching the surrounding style exactly.
- JSDoc on every function.
- No new dependencies.
- Command strings cross TWO shells (n8n Execute Command, then `role-run.mjs`
  with `shell: true`). Keep every argument free of spaces and quotes. Do not add
  a free-text argument.
- Read every file before editing it.
- Do not commit, do not push, do not deploy, do not touch git at all.
- Do not modify `process-map.mjs`, `bindings.mjs`, `roles/decide.mjs`, or
  anything outside `n8n-prototype/` and its tests.
