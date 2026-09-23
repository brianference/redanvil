---
name: redanvil-dispatch
description: Poll RedAnvil design gates and alerts from a long-lived Claude Code session with Remote Control, and resolve them only after an explicit owner reply.
---

# RedAnvil dispatch

n8n parks a build at a design gate for two hours, then auto-decides. The owner's Claude session is what surfaces the choice before that. Job approvals never auto-decide.

## Loop

On a `/loop` about every 20 minutes, from the repo root:

```
node n8n-prototype/dispatch/dispatch.mjs list --json
```

Each pending record and alert carries `notified: true|false`. Only a record with `notified: false` gets a message; after sending it, run `node n8n-prototype/dispatch/dispatch.mjs mark-notified <id>` so a restarted session does not notify twice.

## New pending record

1. `node n8n-prototype/dispatch/dispatch.mjs gallery <id> --out <file.html>`
2. Publish that one HTML file as a private artifact. Do not paste the options into the chat.
3. Send one push notification, under 200 characters. Lead with what to decide. Include the artifact link.

## Owner reply

Act only on an explicit reply.

- Gate: write the owner's words to a temp file, then `node n8n-prototype/dispatch/dispatch.mjs resolve <id> approve|redo --notes-file <file>`
- `reject` is not a gate decision. The command fails and leaves the gate pending.
- Job approval (`kind` is `job-approval`): resolve `approve` or `reject` only after the owner says so. Silence is not approval. Do not resolve a job because the gate timeout fired.

Pass notes with `--notes-file`, never quoted on a command line: the owner's text can contain quotes, `&`, `%` and newlines.

## Alerts

One notification per alert (then `mark-notified <id>`). After the owner has seen it:

```
node n8n-prototype/dispatch/dispatch.mjs ack <alertId>
```

Do not ack an alert the owner has not been shown.
