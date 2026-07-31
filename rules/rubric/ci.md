# CI-workflows lane (v1.0.0)

- ci-actionlint (major, det): actionlint clean.
- ci-sha-pinned (blocker, det): third-party `uses:` SHA-pinned with a version comment.
- ci-least-privilege (blocker, det): `permissions:` present and least-privilege; no `write-all`; `persist-credentials: false` on checkout.
- ci-no-injection (blocker, det): no `pull_request_target` with untrusted checkout; no untrusted `${{ }}` interpolation into scripts.
- ci-exit-code-integrity (major, det): a verification command's exit code is its own, never a filter's. `cmd | tail -5` exits with tail's status, and tail almost always succeeds, so the step reports success whatever happened upstream. In one session this hid a Playwright run that reported exit 0 with a failing test, and a `git merge` that printed 0 while aborting. Piping to grep to FIND something is fine; piping the command whose exit code decides whether CI passes is not. `set -o pipefail` with `shell: bash` is the fix and is exempt.
