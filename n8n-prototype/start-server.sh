#!/usr/bin/env bash
# Start the n8n SERVER with the environment RedAnvil's workflows need.
#
# `run-slice.sh` runs ONE workflow through the CLI and exits. That path cannot
# host a build: `n8n execute` has no webhook context, so it cannot run the
# webhook trigger, and it cannot suspend on a Wait node either. The full build
# is driven by a POST to the server, so the server needs the same environment
# the CLI path already sets -- and a server started without it fails in a way
# that looks like a broken workflow rather than a missing variable.
#
# Every variable here is the same one run-slice.sh exports, for the same
# documented reason. See that file's header for the N8N_BLOCK_ENV_ACCESS_IN_NODE
# widening and why it is scoped to this local single-author instance.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export N8N_USER_FOLDER="${N8N_USER_FOLDER:-$HERE/.n8n-home}"
export N8N_BLOCK_ENV_ACCESS_IN_NODE=false
export N8N_RUNNERS_ENABLED=true
export N8N_DIAGNOSTICS_ENABLED=false
# Execute Command ships blocked by default from n8n 2.0; every role runs on it.
export NODES_EXCLUDE="[]"

# LOOPBACK ONLY. n8n defaults to `::` (every interface) and this instance runs
# Execute Command by design, so every workflow it exposes is a path to running
# processes on this machine.
export N8N_LISTEN_ADDRESS=127.0.0.1

export REDANVIL_REPO="${REDANVIL_REPO:-C:/Users/brian/RedAnvil}"
export REDANVIL_RUNNER="${REDANVIL_RUNNER:-$HERE/role-run.mjs}"

cd "$HERE"
exec npx n8n start
