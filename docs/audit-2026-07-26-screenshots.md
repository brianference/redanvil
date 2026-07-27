# Fifth audit — 2026-07-26: every "both themes" screenshot was one theme, twice

Found while re-running `reverify` after an unrelated wizard change. The diff showed the light and
the dark PNG for the same page changing by the same number of bytes. They were not similar. They
were identical:

```
f268f4b1c5461fc796b0748d4026d092 *app-builder-1280-dark.png
f268f4b1c5461fc796b0748d4026d092 *app-builder-1280-light.png
6138531eadf8059762b135145bcde17f *app-builder-375-dark.png
6138531eadf8059762b135145bcde17f *app-builder-375-light.png
def0703c0f23d3c15fbb934039372c51 *dashboard-1280-dark.png
def0703c0f23d3c15fbb934039372c51 *dashboard-1280-light.png
```

Both apps. Every width.

## Cause

`screenshots.mjs` set Playwright's `colorScheme`, which emulates the `prefers-color-scheme` media
query. The apps do not read that query. `ThemeToggle.resolveTheme` reads `localStorage.theme` and
falls back to the dark brand default:

```ts
function resolveTheme(stored: string | null): ThemeChoice {
  if (stored === 'light' || stored === 'dark') return stored;
  return 'dark';
}
```

So the emulation had no receiver and every capture rendered dark. This became total when the dark
default landed — before that the fallback consulted the system preference, and the emulation
happened to work. One change to an app's theme resolution silently disarmed the harness that was
supposed to be watching it.

## Why it survived

The harness reported success. It wrote twelve files, exited 0, and said so. Nothing compared the
two files it had just written, so "captured a light theme" and "captured the dark theme twice"
produced identical output — twelve PNGs and a zero exit.

Every visual rubric verdict recorded against that evidence was earned by a measurement that could
not fail. This is the same shape as [[reference_measurement_self_check]]: the flattering direction,
on first run, with no code change to explain it.

## Fix

Two parts, because either alone would have failed again.

1. **Drive the theme the way the app resolves it.** `page.addInitScript` seeds `localStorage.theme`
   before any page script runs. `colorScheme` stays — it is still correct for media-query CSS.
2. **Fail closed on an invariant the driver cannot fake.** A light and a dark render of the same
   page cannot be byte-identical. The script now sha256s each capture and exits 1 when a pair
   matches, naming the route and width.

Verified: the guard fires on the broken input (identical pairs → exit 1, named routes) and passes
on the fixed one (`light != dark on every page`). The light capture at 1280 was reviewed by eye and
is a real light theme — white surfaces, `rgb(17,17,20)` heading text against the dark theme's
`rgb(245,245,247)`.

## What this generalises to

The repo has several checks that assert a property of a page. Every one of them has the same
failure mode: if the driver silently fails to reach the state it claims to be measuring, the check
passes. `desktop_width.mjs` grew the same guard after measuring containers instead of painted
content, and `wizard_width.mjs` refuses to pass when it measured zero steps.

**A measurement script needs an assertion that it measured the thing at all, separate from its
assertion about the result.** That is now true of three of them. It should be true of all of them.
