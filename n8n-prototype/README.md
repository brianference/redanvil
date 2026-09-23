# n8n prototype -- product to gate, as verified compartmentalised tasks

A working slice of the RedAnvil process map running on self-hosted n8n 2.22.6.
Not a migration. n8n owns orchestration, durability and the human gate; the
existing roles, gate and worktree enforcement stay exactly where they are.

## What was proven, with the execution ids that prove it

Run: `bash run-slice.sh`

| execution | workflow | status | what it demonstrates |
|---|---|---|---|
| 14, 15, 16 | role | success | three roles recorded as separate sub-executions, each retryable alone |
| 13 | slice | **waiting** | the parent durably paused at the human approval gate |
| 11, 12 | both | error | a refused role, with its reason preserved |

Artifacts the passing run produced, all above the substance floor:

```
1452 bytes  .demo/docs/product/BRIEF.md
1329 bytes  .demo/design-refs/logos/DECISION.md
1411 bytes  .demo/design-refs/design-options/DECISION.md
```

## The part n8n does not give you

n8n can tell you a step exited 0 and it can retry that step. It has no opinion
on whether the step did any work. "The artifact exists" is not "the role
produced it" -- a file left by a previous run satisfies an existence check
forever. So `role-run.mjs` carries the verdict:

```
countedAsRun = exit 0  AND  a declared artifact actually changed  AND  it has substance
```

Change detection is a **content hash**, not mtime, so a role that rewrites a
file with identical bytes has produced nothing and is refused.

### It was tested against inputs designed to make it fail

A check that cannot fail is not a check. All five verified by reading the
verdicts, not the exit codes alone:

| case | expected | result |
|---|---|---|
| role exits 0, writes nothing | FAIL | `no artifact changed -- role did nothing` |
| role writes a 12-byte placeholder | FAIL | `placeholder artifacts under 512B: DECISION.md` |
| role writes 900 real bytes | PASS | nothing objected |
| role writes real bytes then exits 3 | FAIL | `role command exited 3` |
| role re-runs, identical bytes | FAIL | `no artifact changed -- role did nothing` |

The last row is the important one: it is the existence-check evasion that has
bitten this project repeatedly, and it is refused.

## Two traps found by running it

**1. Execute Command discards stdout when the command exits non-zero.**
`ExecuteCommand.node.js:96` returns `json: { error: error.message }` on the
failure path instead of `json: { exitCode, stderr, stdout }`. A refused role
reaches the workflow as a bare "command failed" with its entire evidence trail
dropped -- the exact opposite of the point. Hence `--exitZero=1`: under n8n the
process exits 0 and the refusal travels inside the verdict, so the `If` node
branches on **evidence** rather than on a process exit code. Outside n8n the
exit code still carries the verdict, so CI is unchanged.

**2. The published docs are wrong about the node id.** The Execute Command page
gives `n8n-nodes-base.executecommand`; the real type is
`n8n-nodes-base.executeCommand`. The docs also omit every `typeVersion` and the
sub-workflow trigger's type string entirely. Every identity in these workflows
was read out of the installed package with `inspect-nodes.cjs`, not from docs
and not from memory.

## Operational notes

- **Execute Command ships blocked from n8n 2.0.** `NODES_EXCLUDE="[]"` re-enables it.
- **Sub-workflows must be published**, not merely imported:
  `npx n8n publish:workflow --id=redanvilRole001`. An unpublished sub-workflow
  fails the parent with "Workflow is not active and cannot be executed."
- **`$env` in Code nodes is blocked by default.** `N8N_BLOCK_ENV_ACCESS_IN_NODE`
  must be the literal string `false`
  (`n8n-workflow/dist/cjs/workflow-data-proxy-env-provider.js:22`). This is a
  real widening -- any Code node can then read `process.env`. It lives in
  `run-slice.sh` for this single-author local instance and must not be carried
  to any instance where someone else can author a workflow.
- **Each role owns a distinct artifact directory.** Point two roles at the same
  path and each takes credit for the other's work.

## What this does not replace

The gate, the 48-row rubric, worktree isolation, the git hooks, and the
independent judge are all still code and still outside n8n. n8n replaces the
PM's loop and the hand-driving -- nothing else. Anything claiming otherwise
would be the same mistake as trusting a spec because it was written down.

## Human gates and the error workflow

A human-gate step registers a pending record, then waits on a form for two
hours. Approve continues. Redo loops to the step named by `reworkTo` (or to
the gate's own step when it has none), until that step's `maxCycles` is
exceeded, and then the execution fails. When the wait limit expires, the
auto-decide role for that axis runs and `resolved/<id>.json` is written with
`decision: "auto-decided"` and `resolvedBy: "timeout"`.

Telegram notify nodes are generated only when `REDANVIL_TELEGRAM=1`.
`REDANVIL_AUTO_GATES=1` still skips the Wait and runs auto-decide immediately.

`workflows/redanvil-errors.json` is the error workflow (id `redanvilErrors001`).
The build workflow JSON sets `settings.errorWorkflow` to that id. n8n reads
that setting when an execution fails and runs the error workflow
(`execute-error-workflow.ts`). Import the error workflow into n8n before the
build workflow so the id exists. In the editor the same setting is the
workflow's error workflow; point the build workflow at "RedAnvil build errors"
if an import did not keep the id.

The error workflow writes `.redanvil/dispatch/alerts/<id>.json` through
Execute Command. It needs `REDANVIL_REPO` in the n8n process environment.

The owner's session uses `node n8n-prototype/dispatch/dispatch.mjs`.
`sweep-orphans.mjs` is dry-run unless `--apply` is passed. Stopping an
execution is `POST /api/v1/executions/{id}/stop` with header `X-N8N-API-KEY`
(n8n 2.22.6 public API). The key is the env var `N8N_API_KEY` and is never
printed. Set `N8N_BASE_URL` when n8n is not at `http://127.0.0.1:5678`
(`start-server.sh` binds `127.0.0.1`).

## Verified live on n8n 2.22.6 (2026-09-23)

The form field names (`field-0`, `field-1`), the `?signature=` resume URL, and the timeout path (the Wait resumes with no `formMode`) were run on a throwaway n8n 2.22.6. Loopback only, port 5699. The home directory was a temp folder, not `.n8n-home`. The proof workflow was built from the same builders as the production generator, with the wait set to 1 minute. Production generation still emits 2 hours, and the committed full-build JSON was not changed.

| execution | n8n status | outcome |
|---|---|---|
| 1 | success | `dispatch.mjs resolve <id> approve` with notes `ok "quoted" & 100%`. Marker file bytes were `A`. Those same note bytes were in the execution data, next to `Decision` `approve` and `formMode` `production`. Resolved record: `decision` approve, `resolvedBy` owner. |
| 2 | success | redo via the CLI. Marker file bytes were `R`. customData `cycles_logo` was `1`. |
| 3 | success | no answer. After the 1-minute limit the marker file bytes were `T`, and `resolved/<id>.json` had `decision` `auto-decided` and `resolvedBy` `timeout`. The execution data had no `formMode`. |

A fourth execution was failed on purpose. n8n marked it `error` and ran `workflows/redanvil-errors.json` (execution 5, success). That wrote `alerts/alert-4.json` with message `live gate proof: forced failure`.

## Files

| path | role |
|---|---|
| `role-run.mjs` | the verified unit of work; emits a verdict, refuses no-ops |
| `workflows/redanvil-role.json` | reusable sub-workflow: run -> parse -> gate -> promote or refuse |
| `workflows/redanvil-app-slice.json` | parent: product -> logo -> layout -> owner approval -> gate |
| `run-slice.sh` | headless runner with the environment the workflows need |
| `inspect-nodes.cjs` | prints ground-truth node types and versions from the installed package |
