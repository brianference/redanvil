#!/usr/bin/env bash
# Shared n8n configuration for RedAnvil. Source this; do not duplicate settings.
#
# Owner decision 2026-08-08: SELF-HOSTED. Execute Command is unavailable on n8n
# Cloud, and every RedAnvil role runs through it, so hosting stays local.
#
# Every variable name here was read out of the installed package
# (@n8n/config/dist/configs/*.js), never from the docs, which omit several and
# disagree with themselves on at least one node id.

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export N8N_USER_FOLDER="${N8N_USER_FOLDER:-$HERE/.n8n-home}"
export N8N_DIAGNOSTICS_ENABLED=false

# Bind to LOOPBACK ONLY. n8n defaults to `::`, which is every interface -- the
# startup banner says "n8n ready on ::, port 5678" and that is not a formality.
# This instance runs Execute Command by design, so every workflow it exposes is
# a path to running processes on this machine, and the build webhook takes a
# POST body. Reachable from the network, that combination is remote code
# execution rather than an internal convenience.
#
# Loopback is the floor, not the whole answer: anything on this host can still
# reach it. Before this webhook is exposed to anything beyond localhost it needs
# real authentication on the node (headerAuth or basicAuth with a credential),
# which is NOT configured here.
export N8N_LISTEN_ADDRESS="${N8N_LISTEN_ADDRESS:-127.0.0.1}"

# Execute Command ships blocked from n8n 2.0. The whole role mechanism is built
# on it, so it is deliberately re-enabled.
export NODES_EXCLUDE="[]"

# Durable scheduler: without it, pending runs live in an in-memory timer and are
# LOST when the instance stops. That already bit us -- the server had to be
# killed to free the broker port and its waiting execution went with it.
export N8N_SCHEDULER_ENABLED=true
export N8N_USE_WORKFLOW_PUBLICATION_SERVICE=true

# The CLI and the editor both bind a task broker. Sharing port 5679 meant
# `n8n execute` failed with "port 5679 is already in use" whenever the editor was
# running, which is why builds had to be walked outside n8n entirely. Separate
# ports let them coexist.
export N8N_RUNNERS_ENABLED=true
export N8N_RUNNERS_BROKER_PORT="${N8N_RUNNERS_BROKER_PORT:-5679}"

# Config reaches Code nodes through $env. This is a real widening -- any Code
# node can then read process.env -- and it is acceptable ONLY because this is a
# single-author local instance. Do not carry it anywhere someone else can author
# a workflow. Verified in
# n8n-workflow/dist/cjs/workflow-data-proxy-env-provider.js:22, which blocks
# access unless this is the literal string "false".
export N8N_BLOCK_ENV_ACCESS_IN_NODE=false

# What the roles need.
export REDANVIL_REPO="${REDANVIL_REPO:-C:/Users/brian/RedAnvil}"
export REDANVIL_RUNNER="${REDANVIL_RUNNER:-$HERE/role-run.mjs}"
export REDANVIL_SLUG="${REDANVIL_SLUG:-pet-sitter}"

# Known limitation, recorded rather than hidden: task runners are in INTERNAL
# mode and the store is SQLite. The docs call internal mode "unsuitable for
# production environments" because runners share the n8n process's user and
# group. External mode needs the n8nio/runners sidecar, which needs Docker, which
# is not installed on this machine. Revisit if Docker lands.
