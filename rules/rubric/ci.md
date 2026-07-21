# CI-workflows lane (v1.0.0)

- ci-actionlint (major, det): actionlint clean.
- ci-sha-pinned (blocker, det): third-party `uses:` SHA-pinned with a version comment.
- ci-least-privilege (blocker, det): `permissions:` present and least-privilege; no `write-all`; `persist-credentials: false` on checkout.
- ci-no-injection (blocker, det): no `pull_request_target` with untrusted checkout; no untrusted `${{ }}` interpolation into scripts.
