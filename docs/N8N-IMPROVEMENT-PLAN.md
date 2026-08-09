# Enforcing RedAnvil with n8n — assessment and plan

Written 2026-08-08 after reading the n8n docs the owner supplied. Every claim
below is either cited to a doc or measured against the running instance. Where I
could not verify something, it says so.

## 1. The decision that changes everything else: hosted or self-hosted

**Execute Command is not available on n8n Cloud.** The node page states plainly:
"This node isn't available on n8n Cloud", and it is disabled by default from
version 2.0 even when self-hosting (`NODES_EXCLUDE="[]"` re-enables it).

The entire current design runs RedAnvil roles as local processes through Execute
Command. On hosted n8n that is impossible — a cloud worker cannot spawn
`grok`, `wrangler`, `git`, or Playwright on this machine.

If the owner wants hosted, the architecture inverts:

| | self-hosted (today) | hosted (n8n Cloud) |
|---|---|---|
| how a role runs | Execute Command spawns it locally | n8n calls a webhook; a local agent polls or receives it |
| what must be built | nothing extra | a local HTTP bridge exposing each role, plus a tunnel or a poll loop |
| secrets | already local | Cloudflare/Grok tokens must reach the runner without going to n8n |
| the gate, git, worktrees | local, unchanged | still local — n8n never touches the repo |

Hosted is defensible: n8n becomes purely the control plane and never holds a
credential. It costs a bridge service and a durable way to reach this machine.
**This is question 1 for the owner and nothing else should be built until it is
answered**, because it decides whether Execute Command stays.

## 2. What is wrong with the current setup, measured

| finding | evidence | severity |
|---|---|---|
| Task runners in **internal** mode | docs: internal mode "poses security risks and is unsuitable for production environments"; external mode with the `n8nio/runners` sidecar is recommended | high for anything but local single-user |
| **SQLite** backing store | `.n8n-home/.n8n/database.sqlite` | fine locally, wrong for queue mode or multiple mains |
| **No durable scheduler** | `N8N_SCHEDULER_ENABLED` and `N8N_USE_WORKFLOW_PUBLICATION_SERVICE` unset | pending runs are lost on restart; already bit us — the server was killed to free port 5679 |
| **Broker port collision** | the CLI and the server both bind 5679, so `n8n execute` fails while the editor runs | blocks headless runs; the reason `run-build.mjs` exists |
| **No external hooks** | none configured | the natural place to enforce "no execution without a clean tree" |
| **`N8N_BLOCK_ENV_ACCESS_IN_NODE=false`** | set in `run-slice.sh` | acceptable for a single author; unacceptable the moment anyone else can author a workflow |
| **No AI Agent nodes** | the workflow is Code + Execute Command only | the judge and brainstorm roles are natural agent nodes and are currently shelled out |

## 3. What the docs say we should be using and are not

**Agents.** n8n has first-class agents: an Agent Builder, tools drawn from
workflows in the same project, session memory on by default, episodic memory
behind an OpenAI credential, and MCP servers as tools. Self-hosted agents need
version 2.32.3+ with the `agents` module enabled — **we run 2.22.6, so this is a
version upgrade, not a config flag.** Not verified whether 2.32.3 is released;
check before planning around it.

Three RedAnvil roles are genuinely agentic and should become Agent nodes rather
than shell-outs: **brainstorm** (ranked features from a PRD), **independent
judge** (fresh-context review over a diff), and **user-refuse** (adversarial
"default answer: no"). The rest — build, deploy, gate, render — are deterministic
and belong in Execute Command or a bridge.

**Sub-workflows as tools.** Already used for the role sub-workflow; the docs
confirm workflows in the same project can be attached to an agent as tools, which
is how a judge agent would call the gate.

**Human-in-the-loop.** Already correct: the Wait node with `resume: form` is the
"user picks" node from the process map, and it is the one thing n8n does that the
current CLI loop cannot.

**Self-hosted AI starter kit.** Bundles n8n + Ollama + Qdrant + Postgres via
Docker Compose, with a shared `/data/shared` folder. Two things worth taking even
if we do not adopt it wholesale: **Postgres instead of SQLite**, and the shared
volume pattern for handing artifacts between n8n and local tooling. Docker is not
installed on this machine, so adopting it is a prerequisite, not a step.

## 4. The plan

### Phase 0 — decide (blocked on the owner)

1. Hosted or self-hosted. Decides whether Execute Command survives.
2. Whether to install Docker. Unlocks Postgres, external task runners and the
   starter kit; without it we stay on SQLite and internal runners.

### Phase 1 — make the current instance correct

- Move the store to **Postgres** (needs Docker) or accept SQLite and record it as
  a known limitation with a reason.
- Enable the **durable scheduler** (`N8N_SCHEDULER_ENABLED=true`,
  `N8N_USE_WORKFLOW_PUBLICATION_SERVICE=true`) so a killed instance resumes
  pending runs instead of dropping them.
- Split the broker port: give the CLI its own `N8N_RUNNERS_BROKER_PORT` so
  headless runs and the editor can coexist. This removes the reason `run-build.mjs`
  had to exist as a workaround.
- Move task runners to **external** mode once Docker exists.
- Stop relying on `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`: pass config as workflow
  input from a single trusted node instead of letting every Code node read the
  environment.

### Phase 2 — bind the remaining 13 roles

Bound and working: `prd`, `product`, `reuse`. Remaining, in map order:
`logo`, `palette`, `layout`, `decide`, `testwriter`, `build`, `content`,
`runners`, `visual`, `qa-runtime`, `judge`, `reverify`, `ship`.

Three are human gates (`logo`, `palette`, `layout` picks, plus `decide`) and
become Wait/form nodes. Three are agentic (`brainstorm` if added, `judge`,
`user-refuse`). The rest are deterministic scripts under `n8n-prototype/roles/`,
each with the same contract discipline: emit a verdict, refuse a no-op.

### Phase 3 — enforcement that does not depend on me remembering

- **External hooks** to refuse an execution whose repo tree is dirty, replacing
  the current convention that `reverify` checks it late.
- The **generator stays the only way** the workflow is authored, with the drift
  test in CI so a step added to the map cannot be missing from the workflow.
- **Escape log** (`escape-log.json`) reviewed each release, with the escape rate
  computed rather than asserted — the metric the portfolio package names as the
  one that would catch a rubric that passes bad code.

### Phase 4 — the parts n8n will never do

The gate, the 48-row rubric, worktree isolation, the git hooks and the
independent judge's *criteria* stay in code. n8n replaces the PM loop and the
hand-driving. Anything claiming otherwise repeats the mistake of trusting a spec
because it was written down.

## 5. Honest status

- 3 of 16 steps run end to end with real artifacts (`prd` drives the deployed
  wizard, `product` extracts, `reuse` queries GitHub with an adoption floor).
- The workflow is generated from the map and a drift test proves every step has a
  node.
- 18 vitest contract tests pass, each proving a contract can fail.
- Nothing beyond `prd` has been exercised inside n8n itself — the walk was done by
  `run-build.mjs` because of the broker port collision. That collision is the
  first thing Phase 1 fixes.

---

## 6. Learnings folded back in (2026-08-08, sushi-finder build)

Every item here is a defect that reached a deployed page, and each produced a
change to the map or a contract rather than a note.

### The recurring shape: an endpoint exists and the UI never calls it

Twice now. pet-sitter shipped a working 172-line assistant Worker whose button
made zero requests. sushi-finder shipped `/api/places` returning twelve real
results for zip 85331 while all three views rendered nothing, because the client
only ever asked D1. Both passed every check that looks at source or at an
endpoint in isolation.

**The only thing that catches it is driving the deployed UI and recording which
requests it actually makes.** `evidence/verify-85331.mjs` does that: fill the real
search box, wait on a real response, assert the API list contains the endpoint.
An endpoint test and a UI test both pass while the wire between them is missing.

### New step: `integration`

R33 said "prove the integration exists TODAY" and no step required one, so the
app's entire premise -- worldwide discovery -- rested on six seeded rows. The
step now sits between `decide` and `build`, and `build` depends on it. Its
contract wants a captured live response, `"live": true`, and a named provider.
A documented API is not a working one.

### Contracts that ran and verified nothing

- **ship** passed while `assetHashMatches` was false. It required the string
  `deployUrl`, which a FAILED deploy also writes. Now requires
  `"assetHashMatches": true`.
- **qa-data** found a dead link, exited 1, and passed its contract because it
  only required the word `checked`. Now requires `"dead": 0`.

Both are the session's dominant failure mode: a check that executes perfectly and
cannot fail.

### False positives, the mirror image

Four now, all the same shape -- a document failed for NAMING the thing it
forbids, or a checker measuring the wrong object:

1. a brief saying "not emoji or letter placeholders"
2. a PRD checklist reading "No placeholder tokens (TBD/TODO/lorem)"
3. a decision doc saying "not chosen, not shortlisted by default", which
   reported three decisions the owner had never made
4. `qa-data` reporting `http://127.0.0.1:<port>/api/health` as a dead citation
   when it is a verification command inside a code span

Markers now require `TOKEN: value`; the link checker strips code spans and skips
local and templated hosts.

### The duplicate-hash contract earned its keep

`visual` requires distinct content hashes. It reported 10 of 18, which looked
like a breakpoint problem and was not: light and dark were byte-identical because
the app wrote `'dark'` to localStorage on first load, pinning every visitor to
dark and making the OS preference unreachable. It had recorded a choice the user
never made. A rendering check found a state-management bug that no source review
would have.

**Initial theme application must never persist.** Only a deliberate toggle writes.

### Delegation

Grok hit `403 personal-team-blocked:spending-limit` mid-build, blocking 11 of 23
roles. Before that, one variations job spent 436K tokens over 8 turns, left its
own generator un-run, and edited five app source files a design task had no
business touching -- because it was dispatched against the app directly instead
of an isolated worktree. Design roles are now scoped to the app directory, and
`judge` is the only role that gets the repository, because it reads `git diff`.
