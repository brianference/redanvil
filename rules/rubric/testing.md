# Testing lane (v1.0.0)

- u-test-presence (blocker, det): changed source files have tests; Storybook play() stories, Playwright specs, and axe specs count on the frontend.
- u-test-acceptance (blocker, det): the app has acceptance specs that drive the real UI in a browser, interact with controls, and assert on the OBSERVABLE RESULT — the rows a filter leaves, the value an input holds, the state a selection exposes — never on the control restyling itself. Unit tests over pure functions prove the functions are right, not that a user can reach them: a build once passed 12/12 design rules, zero axe violations and 49 unit tests while shipping a calendar that could not select a date range and a route that could not be changed, because the correct filter logic was never wired to a control. See R27.
- u-test-adequacy (major, det+judge): a new public field, branch, or behavior in the diff is referenced by at least one assertion in the diff's tests.
- u-test-behavioral (major, judge): tests assert behavior and error branches, not implementation details; mock at the boundary seam.
