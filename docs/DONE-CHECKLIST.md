# Definition of done

Nothing may be called done, finished, shipped, complete, or working until every
row below has been **measured** and its **evidence artifact opened**. A spec, a
prompt, a plan, or a rule file is never evidence. Neither is a delegated agent's
summary of its own work.

The test for each row is the same: *name the artifact, and confirm you opened it
in this session.* If you cannot name it, the row is **not verified** — say that,
never "done".

## Why this file exists

In one session, three requirements were written correctly into delegation
prompts and never checked:

- legal pages specced "real content, no boilerplate" shipped at **81 words**
- a brand mark specced "real generated logo, never emoji" shipped as the literal
  text **`AZ`** in a `<span>`
- screenshots were specced and never captured, so a light theme whose hero
  rendered **black inside a light page** went to production

Each time the prompt was right, the artifact was never opened, and the silence of
an unrun check got filled in with the intent of the spec.

## A. The build itself

| # | Must be true | Evidence artifact | How it fails silently |
|---|---|---|---|
| A1 | `tsc --noEmit` exits 0 | terminal output, read | — |
| A2 | `eslint . --max-warnings 0` exits 0 | terminal output, read | — |
| A3 | Unit tests pass | test summary line, read | a suite that cannot start looks identical to one with nothing to say |
| A4 | Acceptance tests pass | Playwright summary, read | a webServer that never becomes ready reports a timeout, not a failure |
| A5 | `npm run build` exits 0 | terminal output, read | — |
| A6 | Coverage ≥ recorded high-water | `coverage/coverage-summary.json`, read | a stale `coverage/` directory reports a number the code no longer earns |

## B. The backend is real

| # | Must be true | Evidence artifact | How it fails silently |
|---|---|---|---|
| B1 | Every route returns 2xx with a non-empty body | captured HTTP response body, read | — |
| B2 | Responses come from the database, not literals | `.prepare()` call sites + a live query count | a handler returning a hardcoded array passes any status check |
| B3 | Not-found paths return 404 | captured response | — |
| B4 | Query parameters actually filter | two responses with **different** row counts | `?q=` accepted and ignored returns 200 with everything |
| B5 | A route that looks like it works actually exists | the served body | an SPA fallback returns **200 with `index.html`** for any unmatched `/api/*` path |

## C. The page, seen

| # | Must be true | Evidence artifact | How it fails silently |
|---|---|---|---|
| C1 | Screenshots captured at 375 / 768 / 1280 | PNG files at the current commit | — |
| C2 | Those screenshots **opened and viewed** | the displayed image | reading the component and inferring the render is not seeing it |
| C3 | Light theme inverts **every** region | light + dark screenshots, compared by eye | an attribute-flip check passes a hero with hardcoded dark tokens |
| C4 | The theme control is discoverable | the screenshot | a text button reading "THEME/System" satisfies "a toggle exists" |
| C5 | Painted content ≥ 80% of viewport at 1440/1920 | `desktop_width` report | measuring a container reports ~93% for a page using a third of the screen |
| C6 | No overlap or clipping at 375px | the screenshot | an ellipsis is not overflow — a truncated label still fails |
| C7 | Zero console errors | console log from the real load | — |

## D. Content is real

| # | Must be true | Evidence artifact | How it fails silently |
|---|---|---|---|
| D1 | Terms ≥ 1200 words, ≥ 8 sections | `design_audit` word/section counts | a stub renders and returns 200 |
| D2 | Privacy ≥ 1200 words, ≥ 8 sections | same | same |
| D3 | Required routes render **distinct** pages | per-route titles and word counts | all four can render the home page and every one returns 200 |
| D4 | Every legal claim is **true of this app** | the code path proving it | boilerplate about cookies you do not set is a false disclosure |
| D5 | Data rows trace to a cited source | per-row citation + a verification run | a correctly-shaped dataset is indistinguishable from an invented one |
| D6 | Brand mark is a real generated asset | the image, opened | the text `AZ` in a span satisfies "a mark exists" |
| D7 | The mark reads at 32px | the **downscaled** image, opened | a good full-size logo becomes a smudge as a favicon |

## E. Shipped

| # | Must be true | Evidence artifact | How it fails silently |
|---|---|---|---|
| E1 | Git repo with a GitHub `origin` | `git remote -v` | — |
| E2 | HEAD pushed | `git rev-list origin/<branch>..HEAD` empty | the repo does not contain what was gated |
| E3 | Production URL returns 200 | captured response | a per-deploy hash URL is not the site |
| E4 | Served asset hash == local `dist` | both hashes, compared | a wrangler success message is not proof |
| E5 | The server measured is **this app** | the served `<title>` | a stale process on the port serves a different app and every number is authoritative and wrong |

## F. Scored

| # | Must be true | Evidence artifact | How it fails silently |
|---|---|---|---|
| F1 | Gate score ≥ threshold | `results/<slug>.json`, read | — |
| F2 | Zero rules with `passed: false` | the same file | a passing score can coexist with a failed blocker if the two paths drift |
| F3 | Every verdict's evidence post-dates its commit | freshness output | re-stamping a verdict is not re-measuring it |
| F4 | Result reproduces independently | `verify_results` output | a hand-authored file has the same shape as a real one |
| F5 | An independent judge reviewed the **diff** | judge verdicts with `file:line` | a judge reviewing its own author's work never dissents |

## G. The measurement itself

Applies to every row above.

| # | Must be true | Why |
|---|---|---|
| G1 | A new check was run against a **known-bad** input and failed | a check that cannot fail carries no information |
| G2 | Two runs of the same measurement agree | if they disagree, report neither until you know which is wrong |
| G3 | A flattering first result was re-checked | every new measurement in one session was wrong on first run, always in the flattering direction |
| G4 | The tool is the standard one | axe-core for contrast, never a hand-rolled parser |
| G5 | The engine is named before comparing | `devices['iPhone 13']` is **WebKit**, not Chromium |

## The one-line test

> Before writing "done", name the artifact you opened. If you are describing what
> you asked for rather than what you looked at, it is not done.
