#!/usr/bin/env bash
# Run the RedAnvil slice workflow headless.
#
# Everything the workflow needs is passed as environment, so no path is baked
# into the workflow JSON.
#
# N8N_BLOCK_ENV_ACCESS_IN_NODE=false is a deliberate, scoped widening: it lets
# Code nodes read process.env, which is how config reaches them. It applies to
# this local single-author instance only. Do not carry it to any instance where
# someone else can author a workflow -- a Code node there could read every
# secret in the process environment. Verified in
# node_modules/n8n-workflow/dist/cjs/workflow-data-proxy-env-provider.js:22,
# which blocks access unless this is the literal string "false".
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export N8N_USER_FOLDER="${N8N_USER_FOLDER:-$HERE/.n8n-home}"
export N8N_BLOCK_ENV_ACCESS_IN_NODE=false
export N8N_RUNNERS_ENABLED=true
export N8N_DIAGNOSTICS_ENABLED=false
# Execute Command ships blocked by default from n8n 2.0; the slice is built on it.
export NODES_EXCLUDE="[]"

export REDANVIL_REPO="${REDANVIL_REPO:-C:/Users/brian/RedAnvil}"
export REDANVIL_RUNNER="${REDANVIL_RUNNER:-$HERE/role-run.mjs}"
export REDANVIL_SLUG="${REDANVIL_SLUG:-pet-sitter}"

WORKFLOW_ID="${1:-redanvilSlice001}"

cd "$HERE"
npx n8n execute --id="$WORKFLOW_ID" 2>&1 | grep -viE "^(Starting|Finished) migration"
