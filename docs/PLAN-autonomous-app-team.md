# Plan — an agent team that finishes an app without being prompted

## The goal, stated as a test

Give RedAnvil a prompt. Walk away. Come back to a deployed, production app that
satisfies its PRD and all 48 rows of `docs/DONE-CHECKLIST.md`, with no
intermediate human turns.

The honest measure of success is this session: it took roughly forty user
messages to get one app shipped, and **every one of the defects the user found
had passed a green gate** -- search 1,042px below the fold, a 32px logo, an
unreachable spring on the timeline, a missing zone explanation, no crop guides.
The system's failure was not the builders. It was that nobody was assigned to
look, and nothing measured what a person would notice first.

So the plan is not "more agents". It is: **assign every failure mode this
session produced to a role that owns it, and make the finish line refuse until
each has reported.**

---

## Part 1 — What actually went wrong, and who owns it now

Each row is a real defect from this session, not a hypothetical.

| What shipped broken | Why nothing caught it | Owner in the new team |
|---|---|---|
| Search result at y=1942 | Rules checked "did it narrow", not "can you see it" | QA-visual |
| Brand mark at 32px | No rule measured rendered size | Designer + QA-visual |
| Timeline unreachable Jan-May | Row ended flush at the edge; looked complete | QA-visual |
| "No zones match" with no explanation | Coverage boundary was never stated | Content writer |
| No crop guides | Nobody asked "what would a user want next" | Brainstormer |
| Prior-art trio missing | It was in a defect table nobody re-read | PM orchestrator |
| Three-option step skipped | Declared "not optional", measured by nothing | Designer + gate |
| AI binding absent in prod | Code was right, environment was wrong | QA-runtime |
| Legal pages at 81 words | Floor was 150 words -- it certified stubs | Content writer |

The pattern: **every gap was a role nobody held.** Not a rule nobody wrote.

---

## Part 2 — The team

Nine roles. Each owns one artifact and one failure mode. No role marks its own
work done.

**1. PM orchestrator.** Owns the worktree, the loop, and the finish line. Runs
every other agent, reads what comes back, and refuses `isDone()` until all 48
rows report. It is the only role allowed to declare completion, and it may not
declare it from an agent's summary -- only from a measurement artifact.

**2. Brainstormer.** Before build, produces a ranked feature list with an impact
estimate and a data-source note per item. Its job is to catch what the PRD
forgot. Output is reviewed, not auto-accepted; a feature with no sourceable data
is listed as blocked rather than built.

**3. Logo designer.** Three distinct marks via Grok Imagine, rendered at 16, 32,
96 and 256px on light and dark, in a gallery. Must report what is legible at
each size. Owns `fe-brand-mark` and `fe-brand-mark-size`.

**4. Layout designer.** Three structurally distinct options each for home,
header/search, footer and one inner page. Same gallery discipline: dark and
light at 375 and 1280, a DECISION.md stating structural difference. Owns
`proc-design-options`.

**5. Content writer.** Terms, Privacy, About, Contact to the 1400-word /
14-section floor with required topic coverage, plus every empty state and
boundary explanation. Owns `fe-legal-substance` and `u-no-placeholders`. Its
hardest rule: every claim must be true of THIS app, verified against code.

**6. Full-stack engineer.** Schema, API, UI. Delegates to Grok Build. Owns the
functional rules.

**7. Test-case writer.** Writes the acceptance tests from the PRD's acceptance
criteria BEFORE the engineer builds, so tests encode the requirement rather than
the implementation. Owns `u-test-acceptance` and `u-claims-covered`.

**8. QA team (three specialists -- this is where this session failed).**
  - *QA-visual*: opens every screenshot at 375/768/1280 in both themes and
    reports what a person would notice first. Owns `fe-result-in-viewport`,
    `fe-responsive-375`, and the "is this actually good" judgement no rule makes.
  - *QA-runtime*: probes the DEPLOYED app -- every route, every binding, real
    data counts. Owns `lg-bindings-bound`, `u-api-real-output`.
  - *QA-data*: proves the data is real and sourced, not shaped. Follows every
    citation and every external link. Owns `D5`, `fe-resource-links`.

**9. Debugger.** Takes a failing measurement and finds root cause before anyone
proposes a fix. Owns the rule that a flaky test is diagnosed, never retried.

**Independent judge** stays as it is: a fresh context scoring the diff, never
the author. It returned 5/10 FAIL on this app when the self-judge would have
returned zero.

---

## Part 3 — Worktree isolation

One worktree per parallel mutator, promoted only when green. Two hazards learned
the hard way this session:

- `git worktree remove --force` follows a `node_modules` junction and deletes
  the real one. Use the existing `worktree/isolate.ts` path, which handles it.
- Two agents in one tree is how a truncated file lands in a commit. The PM
  assigns disjoint paths, and never stages while a delegated run is in flight.

Roles that only read (brainstormer, judge) do not need a worktree. Roles that
write get one each.

---

## Part 4 — Vitest and pytest

Checked against the Vitest docs rather than written from memory, which changed
the design: Vitest supports a **`projects`** array (multi-project config) and a
**browser mode with visual regression testing**. Part of QA-visual does not need
a bespoke harness.

### Vitest — three named projects, one config

```ts
// vitest.config.ts
export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit',    environment: 'node',
                include: ['**/test/**/*.test.ts'],
                exclude: [vrtPattern, ...defaultExclude] } },
      { test: { name: 'browser', browser: { enabled: true, headless: true,
                provider: playwright(),
                instances: [{ browser: 'chromium' }] },
                include: ['**/*.browser.test.ts'] } },
      { extends: true,
        test: { name: 'vrt',
                browser: { headless: true,
                  instances: [
                    { browser: 'chromium', viewport: { width: 375,  height: 900 } },
                    { browser: 'chromium', viewport: { width: 1280, height: 900 } }
                  ] },
                include: [vrtPattern] } }
    ]
  }
})
```

Named projects matter for the gate: a failure reports which lane failed, so
"tests passed" can never mean "the unit lane passed and nobody ran the rest".

- **unit** -- pure functions, handlers, and the orchestrator itself. The default.
- **browser** -- real-DOM behaviour that jsdom fakes badly: focus order, the
  combobox keyboard path, scroll containers, `scrollIntoView`. The timeline bug
  (24 cells, no scroll container) is a browser-lane test.
- **vrt** -- visual regression at 375 and 1280 via `toHaveScreenshot`. This is
  the mechanical half of QA-visual: it catches *changes*. It cannot catch "this
  was always bad", which is why the judgement half and `user-refuse` still exist.

One caveat from the docs worth knowing: coverage is collected once for the whole
run from the root config, and projects share it. Do not expect per-project
coverage thresholds.

### Vitest — what the docs give us that we were not using

Beyond `projects`, three features change how the team tests:

- **Jest-compatible API and zero-config TS/ESM/JSX.** No separate build step for
  tests, and the same Vite plugin pipeline as the app -- so a test loads the app
  exactly as the browser does. That matters for the CSP: a test that transforms
  differently from the build can pass against code that fails in production.
- **Instant watch, rerunning only related changes.** The debugger role uses this
  during root-cause work rather than re-running a full suite per hypothesis.
- **`toHaveScreenshot` in browser mode.** Visual regression becomes a first-class
  test instead of a bespoke script, at both viewports, in the `vrt` project.

Framework-agnostic matters here too: the same runner covers app code, Workers
handlers, and the orchestrator itself, so the tooling that judges an app is
tested by the tooling it judges with.

### Pytest — the data lane

Pytest earns its place where the problem is data, not DOM:

- source transcription (az1005 -> rows), citation integrity, link resolution
- `hypothesis` property tests over generated inputs, which beat table-driven
  cases for invariants:
  - every planting window resolves to a source that exists
  - no window falls outside its publication's stated coverage
  - **no metrics combination yields "pass" when the primary result is
    off-screen** -- the property this session violated
- QA-visual's decision function is exported pure so pytest can exercise it
  alongside vitest. If the decision only lives inside a Playwright script,
  neither runner can reach it and the measurer stays unvalidated.

Concrete shape, from the pytest docs:

- **`conftest.py`** holds shared fixtures -- a loaded D1 snapshot, an HTTP client
  with the browser user-agent link-checking needs, and the parsed source
  publications. Fixture scope does the work: `scope="module"` for an expensive
  publication parse, function scope for per-case data.
- **`@pytest.mark.parametrize`** over all 45 crops and all 8 zones, with `ids=`
  so a failure names the crop rather than printing `test_window[17]`. A failing
  citation should say `test_window_resolves[crop-tomatoes]`.
- **Registered markers under `--strict-markers`**, declared in `pyproject.toml`:
  `slow`, `network`, `data`. Strict mode turns a typo'd marker into an error
  instead of a silently skipped test -- the same fail-closed principle the gate
  uses everywhere else.
- **Assertion introspection** is why pytest suits this lane: a failed data
  invariant prints the actual row, so the diagnosis is in the failure output
  rather than requiring a re-run with logging.
- **Exit code is the gate signal.** `u-test-runners` reads it per lane; `network`
  can be deselected locally but never in the gate run.

Do not add pytest to a project with no Python. The rule is n/a when no runner is
configured, and fail-closed when one is configured and failing.

### The gate rule

`u-test-runners` detects every configured runner and lane, runs each, and
requires each to pass **independently**. It reports the lane names it found and
each result, so a green unit lane cannot stand in for the whole suite.

## Part 5 — The loop

Extend `loop/ralph.ts` rather than writing a new engine.

```
for iteration in 1..N:
    PM: read current gate result + unmet checklist rows
    PM: assign each unmet row to its owning role
    roles run in parallel, in isolated worktrees, bounded
    PM: promote only green worktrees
    PM: run the gate; run the independent judge on the diff
    PM: isDone()?  -> yes: deploy, verify served hash, stop
                    -> no: feed verbatim failures back, next iteration
    no iteration cap, no budget ceiling -- the loop exits by finishing.
    two iterations with no change means change the approach, not stop.
```

Two hard rules the PM enforces:

- **No role may report its own work done.** A role returns an artifact; the
  measurement decides.
- **The loop may not lower a bar to converge.** If a rule cannot be satisfied,
  it escalates with the measurement, and the run ends unfinished rather than
  ending green.

---

## Part 6 — What has to be built

Ordered by dependency. Estimates are honest ranges, not promises.

1. **Role registry + prompts** -- nine role definitions with their owned rules
   and required artifacts. (small)
2. **PM orchestrator** -- row-to-role assignment, worktree fan-out, promotion.
   Extends `commands/loop.ts`. (large -- this is the real work)
3. **QA-visual as a first-class role** -- the biggest gap. Needs a harness that
   captures, opens, and *reports on* screenshots rather than asserting on them.
   (medium)
4. **Pytest lane + `u-test-runners` rule** -- per-runner, fail-closed. (medium)
5. **Per-runner gate wiring** so one runner cannot mask another. (small)
6. **Design-variation roles** producing four galleries per app. (medium)
7. **End-to-end rehearsal** -- run the whole thing on a fresh throwaway PRD and
   measure how many human turns it needed. That number is the acceptance test
   for this plan. (medium)

---

## Part 7 — The risk I want stated up front

An autonomous loop that cannot stop will happily converge on *looking* done. Every
guard in this plan exists against that, and the strongest one is the cheapest:
**the finish line reads measurements, never summaries.** This session's evidence
is that agents (including me) report success from intent rather than artifacts
unless something forces the artifact open.

Cost is handled by splitting execution roughly 50/50 between Grok Build and
Claude (spec section 5c): Grok takes the volume work -- implementation, copy,
test bodies, image generation -- and Claude takes the judgement work, where a
wrong answer is expensive. Whichever side produces, the other checks, so the
saving does not come out of quality.

The loop does not stop on cost and does not stop on iteration count. It exits by
finishing. A row that will not move gets reassigned or decomposed, never
abandoned, and no bar is ever lowered to converge.

---

## Part 8 — What the first real run proved wrong (2026-08-02)

RA-175 landed the role registry, worktree enforcement, and the two refusal gates
this plan called for. Running the team for real the same day surfaced three
coordination failures the design had not accounted for. None of them is a rule a
gate check can catch, because none is about content -- they are about
scheduling and shared state between agents, the exact class this plan assumed
worktree isolation alone would remove.

**Two agents idled waiting on each other.** The registry's `owns` declaration
says what a role produces, but nothing says what it needs first. When the row
assignment step dispatches every unmet-row owner in one parallel batch, a role
whose input is another role's not-yet-written artifact (a tester waiting on a
ranked feature list, a QA role waiting on a deploy the engineer has not
finished) has nothing to read and nothing useful to do, and the PM has no signal
that either is blocked rather than working. Fix: add `dependsOn: string[]` (role
ids) to each role definition in `src/team/roles.ts`, and have the PM
topologically sort the roles it assigns per iteration -- a role is not dispatched
until every role it depends on has its declared artifact on disk for this
iteration. A cycle in `dependsOn` is a hard error at startup, not a runtime
stall.

**`reverify` refused on a tree a different agent had dirtied.** The specific
form of this hit today is in `0440921` (`AZ-9 fix(evidence): cite the paths
reverify actually regenerates`): reverify refuses to run against a dirty
working tree, evidence has to be committed to clear that tree, committing
advances HEAD, and any evidence file reverify itself does not rewrite is now
permanently older than the commit it is supposed to vouch for -- a structural
deadlock, not a stale file. That fix narrowed the immediate cause (evidence
pointed at hand-named files nobody regenerates) but not the general one: any two
agents sharing one physical tree can dirty it for each other regardless of whose
evidence is stale. The PM must never assign two roles to the same tree in the
same iteration, and a role's promote step must confirm the tree it is about to
commit is the one it wrote -- not merely that the tree happens to be clean when
it looks.

**One file, two writers.** Per-role worktrees make source conflicts rare, but
several roles legitimately write into the same shared artifact --
`evidence/measurement-meta.json` is exactly this shape, and today's working
tree independently had that file (and its known-bad-fixture copies) modified in
more than one place at once. A last-write-wins promote silently drops the first
writer's entry, and the row that role owned reverts to unmeasured with no error
anywhere. Fix: `assignUnmetRows` must treat "artifact path" as shared-writable
only when a role explicitly declares it as such, and promotion of a
shared-writable path must merge by key (the rule id) rather than overwrite the
whole file. A role writing to a path another concurrently-assigned role also
declares, without either declaring it shared, is the same class of error as an
unowned row: print it and fail, rather than let the second commit silently win.

The lesson underneath all three: worktree isolation solves the source-tree
collision this repo hit in July (`docs/claude-grok-teamwork.md`), but a team of
nine-to-twelve roles reintroduces coordination failure at the scheduling layer,
above the tree. The fix is not more isolation -- it is making dependency and
shared state explicit in the role registry instead of assumed.
