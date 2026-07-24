# Repo hygiene lane (v1.0.0)

- hyg-secret-scan (blocker, det): secret scan on the diff, run before any external API call; fail closed.
- hyg-no-binaries (blocker, det): no committed binaries, archives, or build artifacts past size and extension thresholds.
- hyg-no-duplication (blocker, det): duplication scan on changed code.
- hyg-env-ignored (blocker, det): env files gitignored; no committed key material.
- u-data-no-placeholder (blocker, det): no lorem ipsum, dummy, or placeholder content in shipped source. Real data only; seed from real examples.
