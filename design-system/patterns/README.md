# Chosen patterns

Reference implementations that were designed as competing concepts, rendered
side by side, picked by Brian, then built and shipped. Each one is here because
it beat two alternatives on a real screen, not because it read well in a spec.

A new app should start from these rather than re-deriving them. The HTML in
`reference/` is self-contained and opens with no server, so a builder can look
at the thing rather than imagine it from a description.

| Pattern | File | Chosen over |
|---|---|---|
| Masthead with section tabs | `reference/masthead-tabs.html` | grid tabs, compact section menu |
| Account identity chip | `reference/account-identity-chip.html` | initials disc, right-edge sheet |
| Portfolio split hero | `reference/portfolio-split-hero.html` | index rail, mosaic first |

Shipped in apply-dashboard on 2026-08-28. Live at apply-dashboard.pages.dev.

---

## Masthead with section tabs

Brand and account on a top row; sections own a full-width tab row underneath.
The current section carries `aria-current="page"` as well as an underline, so it
is announced and not only painted.

**Why this one.** It gives every section a full-width target, marks the current
one unambiguously, and leaves the top row clear for the account control. The
grid-tab alternative wrapped its four buttons into a 2x2 block at desktop width
with a large empty gap beside them, which reads as broken rather than
deliberate.

**What to copy.** The two-row split, the `aria-current` on the active tab, and
scoping every selector under `header.site`.

**What bit us.** The stylesheet was NOT scoped at first, and `.panel` is both
the nav's absolutely-positioned sign-in dropdown and a content card class a page
happened to use. The card was lifted out of flow and that page rendered as a
blank screen under a working header. Sixteen automated checks passed while it
was blank, because every one of them asked about the nav and none asked whether
the page had a body. **A stylesheet loaded by pages it does not own must not use
a bare class name.**

## Account identity chip

An initials avatar plus a caret in a pill. The menu opens with a who-you-are
block - avatar, name, address, "signed in" - then the destinations, a
separator, and sign out.

**Why this one.** The header previously printed the raw email address as a
button. It wrapped badly on a phone, put the address on screen for anyone
nearby, and gave no affordance that a menu was behind it.

**What to copy.** Initials in the trigger, the full address only inside the open
panel, `aria-expanded` on the trigger, close on Escape and on click-outside,
and a click handler on the panel that stops propagation - without it the panel
shuts the moment the user reaches for the password field.

**What bit us.** Initials were derived from the email, and
`brianference@protonmail.com` yields **BR**: that local part is one run of
letters with nothing marking where the surname starts. Derive initials from a
display NAME and fall back to the address. Store that name as a column; it was
a string literal in two different endpoints first, which is a fact with no
source and two places to drift.

## Portfolio split hero

Identity and a short pitch on one side, a featured screenshot on the other,
then full-width project rows where the screenshot and the words swap sides down
the page.

**Why this one.** The page it replaced opened with four dense paragraphs before
a single piece of work appeared, and stacked each screenshot above its own
words so the images stayed small and the width went unused. In the shipped
version the first screenshot appears 145-346px down instead of below the fold.

**What to copy.** Evidence in the first screen. Text beside the screenshot at
desktop width, stacking on mobile with the screenshot still first. One
paragraph of prose in the hero and the rest of the resume below the work.

**What bit us.** Lifting the concept's CSS while dropping its `:root` block took
the design tokens with it, so every `var(--bg)` resolved to nothing and the body
computed to `rgba(0, 0, 0, 0)` - a page with no background at all. If you
extract a stylesheet from a concept, extract the tokens or replace them.

---

## Rules these confirmed

- **Light is the default**, whatever the operating system prefers. Define the
  light palette on bare `:root` and dark only under `:root[data-theme="dark"]`.
  No `prefers-color-scheme` block: the theme toggle treats an unset attribute as
  light, and honouring the OS makes the two disagree - a dark-mode machine gets
  a dark page the toggle believes is light, so the first click does nothing.
- **A class that sets `display` beats the `hidden` attribute.** That bit twice
  in one day: an empty error box painted on every load, and a password field
  stayed on screen in a view that had explicitly hidden it. One
  `[hidden] { display: none !important; }` rather than a selector per component.
- **Screenshots below the fold use `loading="lazy"`,** so a viewport-sized
  capture will show some as not-yet-loaded. That is the attribute working. Scroll
  the page before asserting that images failed, or the measurement reports a
  defect that is not there.
- **Look at the render.** Every defect above passed its numeric checks.
