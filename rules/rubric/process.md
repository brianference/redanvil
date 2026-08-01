# Process lane (v1.0.0)

- proc-pr-title-ticket (blocker, det): PR title starts with the ticket key.
- proc-conventional-commits (minor, det): commit prefixes feat / fix / docs / refactor / test / chore.
- proc-artifact-verified (blocker, det): a SPEC is not a deliverable. For every recorded verdict, every cited evidence path must (1) exist on disk at the reviewed commit, (2) be an OUTPUT artifact — a measurement report, screenshot, captured HTTP response, or test run — not a plan, prompt, PRD, rule file, or markdown describing intent, and (3) be non-trivial (a screenshot under a few KB, a report with no findings, or a JSON file with an empty results array does not count). FAIL names the rule id and the offending path. Crediting a requirement because it was written down rather than because it was verified is the failure class this blocks.
