# Integration testing with pytest

The `testwriter` role writes two layers, and they answer different questions.
Vitest asks "does this unit behave?"; pytest asks "do these parts work together?"
RedAnvil's real defects have almost all been seam defects — a Node-only global
that passes every unit test and throws in Workers, an endpoint the UI never
calls, a `status === 404` guard that never fires because Pages answers with
`index.html` at 200. None of those are visible to a suite that mocks its
collaborators.

## Where it lives

```
<app>/test/acceptance/*.test.ts    vitest, written from the PRD before the build
<app>/test/integration/test_*.py   pytest, real DB + real endpoints + real browser
<app>/test/integration/conftest.py fixtures
<app>/pytest.ini                   marker registration
```

Both directories are declared in `n8n-prototype/process-map.mjs` under the
`testwriter` step, so a missing integration suite fails the contract instead of
passing quietly.

## Markers

Register the marker, then keep the two lanes separable:

```ini
[pytest]
markers =
    integration: exercises real collaborators (DB, HTTP, browser)
```

```bash
pytest -m integration          # the slow lane
pytest -m "not integration"    # the fast lane, safe to run on every save
```

An unregistered marker is a typo waiting to happen: `pytest -m integraton`
silently selects nothing and reports success. Registering it makes the typo an
error.

## Fixtures, not module-level setup

Fixtures carry setup and teardown, and their scope is the part that matters.
Session scope for the expensive, immutable things (starting the server); function
scope for anything a test mutates. State that leaks between tests is what makes a
suite pass in one order and fail in another.

```python
import pytest

@pytest.fixture(scope="session")
def base_url():
    """The served build. Session-scoped: starting it per test is wasteful."""
    return "http://127.0.0.1:8788"

@pytest.fixture()
def seeded_db(tmp_path):
    """Function-scoped: each test gets its own database and cannot poison a peer."""
    ...
```

Mock only what you do not own. Third-party HTTP goes through `responses`; the
endpoint under test does not get mocked, because mocking the layer under test is
how a suite proves nothing.

## React, via pytest-playwright

`pip install pytest-playwright` provides a `page` fixture that manages the
browser lifecycle for you and runs a real engine (Chromium, Firefox, WebKit).

```python
import pytest

@pytest.mark.integration
def test_forge_prd_renders(page, base_url):
    page.goto(base_url)
    page.get_by_role("textbox", name="Describe your app").fill("a reminder app for dog owners")
    page.get_by_role("button", name="Send description").click()
    # Auto-waiting: no sleep. React renders asynchronously and a fixed sleep is
    # exactly what makes these suites flaky.
    expect(page.get_by_role("button", name="Forge PRD")).to_be_visible()
```

Two rules carried over from `playwright-qa`, because they apply identically here:
drive by role, and wait on a real signal rather than a duration.

One engine caveat worth repeating: a project labelled "mobile" on
`devices['iPhone 13']` runs **WebKit**, not Chromium, and WebKit omits links from
sequential focus navigation by default. Name the engine before comparing two
browser measurements.

## Ordering

Get the suite green serially before reaching for `pytest-xdist`. Parallelism
turns a single shared-state bug into an intermittent failure, which is far harder
to read than the deterministic one you started with. Use `pytest-asyncio` only
when the code under test is actually async — it is not a general speed-up.

## The bar

Every integration test must be able to fail for the reason it claims. Before
trusting one, break the thing it covers in a scratch copy and watch it go red. A
test that stays green against a broken backend is not testing the backend, and a
green suite is worth exactly as much as its ability to turn red.
