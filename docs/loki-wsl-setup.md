# Running RedAnvil's overnight loop under Loki Mode in WSL

Written 2026-08-22. Every claim about the CURRENT machine state below was
measured on that date and is marked. Everything about Loki's own behaviour that
was not measured is marked `[UNVERIFIED]`, because this machine cannot run it
yet and reading a doc is not running a thing.

## Why this document exists

The overnight loop stayed on Windows and the Windows path has now failed to
deliver an unattended run twice. The specific blocker is not Loki: it is that a
Claude Code session cannot relaunch itself here, so when the session pauses the
orchestration stops even though n8n and Grok keep running. A Linux host removes
that constraint, because the loop becomes a plain process under a scheduler
rather than a chat session.

## The measured starting position

`n8n-prototype/loki/overnight.mjs` opens by recording why it exists rather than
`loki start`:

```
npm error notsup Unsupported platform for loki-mode@9.22.12:
wanted {"os":"darwin,linux"} (current: {"os":"win32"})
```

So `loki-mode` is a published npm package whose `engines.os` is `darwin,linux`.
It cannot install on win32 at all -- this is a package refusal, not a runtime
error you can work around with a flag.

**Measured 2026-08-22:** `wsl.exe` EXISTS at `C:\Windows\system32\wsl.exe`, and
running `wsl.exe --status` returns:

```
The Windows Subsystem for Linux is not installed.
You can install by running 'wsl.exe --install'.
```

So the stub shipped with Windows is present and no distribution is installed.
Installing needs elevation and a reboot, which is why previous sessions stopped
here.

## What already works, and what the switch actually changes

`overnight.mjs` was built so that adopting Loki replaces the executor and
nothing else. The detection is small and worth reading before trusting this
document:

```js
function detectLoki() {
  const probe = run(process.platform === 'win32' ? 'where' : 'which', ['loki'], { timeout: 10_000 });
  if (probe.status !== 0) return { available: false, version: null };
  const version = run('loki', ['version'], { timeout: 20_000 });
  return { available: version.status === 0, version: version.stdout.trim() || null };
}
```

Two conditions, both required: `loki` must be on PATH, AND `loki version` must
exit 0. A binary that exists but errors is treated as absent, which is the right
way round -- this project has been burned by `grok models` reporting a false
negative on a working credential, so presence alone is never taken as health.

The queue, the evidence receipts, the worktree isolation and the gate verdict
are all unchanged by the switch. `meets_the_bar` keeps the final say; Loki's own
receipt never overrides it.

## Step 1 -- install WSL2 and a distribution

Run from an ELEVATED PowerShell. This reboots the machine.

```powershell
wsl.exe --install -d Ubuntu-24.04
```

That single command enables the `Microsoft-Windows-Subsystem-Linux` and
`VirtualMachinePlatform` optional features, fetches the WSL2 kernel, and
installs the distribution. After the reboot, Ubuntu opens once to create a UNIX
user.

Confirm before going further, and read the output rather than assuming:

```powershell
wsl.exe --status
wsl.exe --list --verbose      # STATE must be Running or Stopped, VERSION must be 2
```

If `VERSION` reports 1, fix it before continuing -- WSL1 has a different
filesystem and networking model and none of the timings below apply:

```powershell
wsl.exe --set-version Ubuntu-24.04 2
wsl.exe --set-default-version 2
```

## Step 2 -- put the repository on the Linux filesystem, not /mnt/c

This matters more than it looks. `/mnt/c` is a 9p network mount, and file
operations across it are roughly an order of magnitude slower than native ext4.
The overnight loop fingerprints every declared artifact before and after each
role (`diffFingerprints` in `role-run.mjs` hashes file contents), and it creates
a git worktree per work item. Both are file-operation heavy.

Clone fresh inside WSL rather than pointing at the Windows checkout:

```bash
sudo apt update && sudo apt install -y git curl build-essential
mkdir -p ~/src && cd ~/src
git clone https://github.com/brianference/redanvil.git
cd redanvil
```

Do not symlink `~/src/redanvil` to `/mnt/c/Users/brian/RedAnvil`. That reintroduces
the slow path AND lets two operating systems write the same working tree, which
is the teamwork failure this project already documented for two agents sharing
one repo.

## Step 3 -- Node

The repo runs Node 22 on Windows today (`node --version` reported v22.19.0 on
2026-08-22). n8n is pinned to `2.22.6` precisely because a `^2.34.5` range once
drifted to a release whose `engines.node` is `>=22.22` and refused to start on
22.19.0. Match the major version deliberately:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node --version            # expect v22.x
npm ci
```

## Step 4 -- Playwright needs system libraries in WSL

A bare Ubuntu image has none of the shared objects Chromium links against, and
the failure mode is an unhelpful launch error rather than a missing-package
message. Install browsers WITH dependencies:

```bash
npx playwright install --with-deps chromium
```

The PRD role drives the live app-builder with Chromium, and the a11y and e2e
harnesses need it too, so this is not optional for a full build.

## Step 5 -- install Loki Mode

```bash
npm install -g loki-mode
which loki                # must print a path
loki version              # must exit 0 -- detectLoki requires BOTH
```

`[UNVERIFIED]` -- the package name, that a global install puts `loki` on PATH,
and that `loki version` is the right subcommand are all taken from
`overnight.mjs`'s own detection code and its header comment, not from a run on
this machine. Confirm each against `npm view loki-mode` and the vendor docs at
autonomi.dev before depending on them. If `loki version` is not a real
subcommand, `detectLoki` will report unavailable forever and the loop will
silently keep using the fallback executor -- which is safe, but it means you
have not actually switched.

## Step 6 -- authenticate the agents

Grok Build is the executor for every judgement and design role. Its credential
lives in `grok login` (a Grok account, no `XAI_API_KEY`), and that login is
per-machine, so the WSL install needs its own:

```bash
grok login
grok -p "reply with exactly: GROK_OK"     # read the reply, do not assume
```

`[UNVERIFIED]` -- whether the `grok` CLI publishes a Linux build and how it is
installed there. The Windows install is a native `grok.exe` at
`C:\Users\brian\.grok\bin\grok.exe` (measured 2026-08-22, a PE32+ console
executable), which tells you nothing about Linux packaging. Check before
planning around it.

Do NOT copy `.env` files across. Re-create secrets in the WSL environment from
their sources. Never `cat` one to check it copied -- verify by a functional API
call, or by `${#VAR}` for length and `${VAR:0:4}` for a type-confirming prefix.

## Step 7 -- n8n

n8n only matters if you want the 24-step full build under WSL as well as the
grind loop. It is pinned:

```bash
cd n8n-prototype
npm ci
```

The server needs the same environment `start-server.sh` already exports, and two
of those variables are load-bearing rather than cosmetic:

| variable | why |
|---|---|
| `NODES_EXCLUDE="[]"` | Execute Command ships BLOCKED from n8n 2.0, and every role runs on it |
| `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` | Code nodes cannot read `process.env` otherwise, which is how config reaches them |
| `N8N_USER_FOLDER` | keeps the sqlite database beside the repo instead of `~/.n8n` |
| `N8N_LISTEN_ADDRESS=127.0.0.1` | n8n binds `::` by default; this instance runs Execute Command, so every exposed workflow is a path to running processes |

`start-server.sh` sets all four. Run it directly:

```bash
bash n8n-prototype/start-server.sh
curl -s http://localhost:5678/healthz      # {"status":"ok"}
```

**Carry the workflow across as a file, and re-import it.** The database copy
drifts from the file silently and execution reads the DATABASE. On 2026-08-21
the DB held 55 nodes while the file held 59, both under the same workflow name,
and the four missing nodes were a feature added a commit earlier. Import, then
publish, then RESTART -- `publish:workflow` says in its own output that changes
do not take effect while n8n is running:

```bash
npx n8n import:workflow --input=workflows/redanvil-full-build.json
npx n8n publish:workflow --id=redanvilFull001
# restart the server here
```

Note that `import:workflow` DEACTIVATES what it imports, so a re-import silently
undoes a publish. Check `active` in the database rather than assuming.

## Step 8 -- schedule it, which is the whole point

This is the constraint that motivated the move. On Windows the loop was driven
from a Claude Code session, and that session cannot relaunch itself: spawning a
nested `claude -p --dangerously-skip-permissions` is refused by the harness
classifier, and scheduling one is the same act indirected. Under Linux the loop
is a process, so cron owns it and nothing needs to relaunch a chat.

```bash
crontab -e
```

```cron
# 23:30 nightly, stop at 06:00, log where it can be read afterwards
30 23 * * * cd $HOME/src/redanvil && /usr/bin/node n8n-prototype/loki/overnight.mjs --until 06:00 --allow-deploy >> $HOME/src/redanvil/logs/overnight.log 2>&1
```

`--until` and `--allow-deploy` are both real flags as of commit `5ac5e34`:
`--until HH:MM` sets a wall-clock deadline (default 06:00) and clamps per-item
timeouts and rate-limit backoff so neither can outlive it; `--allow-deploy` is
now actually READ, which it was not before that commit, and `lg-shipped` cannot
clear without it.

`cron` runs with a minimal environment. Anything the loop needs -- PATH entries
for `node`, `git`, `grok`, and any credential the agents read -- must be set in
the crontab or sourced by a wrapper script. A cron job that fails because `git`
is not on PATH is the same class of failure as the Windows scheduled task that
had never run once.

## Step 9 -- prove it before trusting it

Do not wait for a night to find out. In order:

1. `node n8n-prototype/loki/overnight.mjs --dry-run --max-items 1` and read the
   receipt it writes under `evidence/receipts/`. A `dry-run` receipt is
   `UNVERIFIED` by design; that is correct, not a fault.
2. `npm test` -- includes `test:n8n`, 35 cases covering the deadline, the
   worktree measure-and-merge, and the backoff clamp.
3. Run the loop for real with `--max-items 1 --until` a time twenty minutes out,
   and confirm the receipt reaches `VERIFIED`, which needs tests run AND passed
   AND a successful build AND a real diff.
4. Only then put it in cron.

A receipt that says VERIFIED after a real item is the first evidence the switch
worked. `detectLoki` reporting `available: true` is NOT that evidence -- it only
means a binary answered.

## What this does not fix

Moving to Linux does not fix the two lanes that are red for their own reasons:

- `apps-meet-the-bar` refuses 6/6 apps that are genuinely below the finish line.
- `results-provenance` is structurally red because verdicts are pinned to the
  commit they were recorded at, every later commit changes files under review,
  and the verdict silently stops counting. See `docs/NIGHT-PLAN.md`.

Nor does it make Grok reliable on long tasks. Three delegations of one spec hung
overnight on Windows and produced nothing; that is a Grok-side behaviour, and
there is no reason yet to believe the platform is the variable.
