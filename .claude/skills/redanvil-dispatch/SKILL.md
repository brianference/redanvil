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

Remember the ids you have already notified. Only a new id gets a message.

## New pending record

1. `node n8n-prototype/dispatch/dispatch.mjs gallery <id> --out <file.html>`
2. Publish that one HTML file as a private artifact. Do not paste the options into the chat.
3. Send one push notification, under 200 characters. Lead with what to decide. Include the artifact link.

## Owner reply

Act only on an explicit reply.

- Gate: `node n8n-prototype/dispatch/dispatch.mjs resolve <id> approve|redo --notes "..."`
- `reject` is not a gate decision. The command fails and leaves the gate pending.
- Job approval (`kind` is `job-approval`): resolve `approve` or `reject` only after the owner says so. Silence is not approval. Do not resolve a job because the gate timeout fired.

Notes are an argument to `resolve`. Do not shell them into another command.

## Alerts

One notification per alert. After the owner has seen it:

```
node n8n-prototype/dispatch/dispatch.mjs ack <alertId>
```

Do not ack an alert the owner has not been shown.
