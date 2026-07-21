# Testing lane (v1.0.0)

- u-test-presence (blocker, det): changed source files have tests; Storybook play() stories, Playwright specs, and axe specs count on the frontend.
- u-test-adequacy (major, det+judge): a new public field, branch, or behavior in the diff is referenced by at least one assertion in the diff's tests.
- u-test-behavioral (major, judge): tests assert behavior and error branches, not implementation details; mock at the boundary seam.
