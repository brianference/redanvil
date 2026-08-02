# Header options -- structural differences

For the live **Timeline + rail** home layout. These options recompose header chrome
only; the half-month timeline remains the hero.

**Option 1 -- Command bar:** One sticky chrome band. Crop search owns the centre;
method, month, zone context, and an Ask action sit in the same band (wrapping on
narrow). Primary nav is a desk strip / mobile menu. Assistant rail on desktop.

**Option 2 -- Two-tier sticky:** Tier A is brand + primary nav + theme. Tier B is
zone selector, frost/elevation context, crop search, method/month filters, and Ask
-- sticks under tier A. Wayfinding and planning controls are separate bands.

**Option 3 -- Compact drawer + dock:** Minimal top bar (brand, search, Filters
toggle, theme, menu). Zone + method + month live in an expandable drawer under the
bar. Assistant is a persistent docked panel (desktop right rail always open; mobile
full-width dock under content, not a FAB).

Separable pieces for a mix: search placement (centre command / tier-B strip /
compact bar), zone+frost (inline mono line / zone row / drawer), filters
(always-on selects / always-on tier-B / drawer), assistant (bar Ask / tier-B Ask /
always-docked panel), nav (desk strip under command / tier-A links / compact menu).

Real data in frames: Cave Creek last frost Feb 20, first frost Dec 6, elevation
2,529 ft (not the superseded Mar 9 / Nov 15 mockup values).

## Chosen

**Option 3 -- Compact drawer + dock.** Chosen by the user on 2026-08-02.

Why: it is the most genuinely integrated of the three. Nav, zone, search and the
filter affordance collapse into one compact bar instead of stacking as separate
bands, and the assistant becomes a persistent dock rather than a panel that
competes with the content. Filters live in an expandable drawer, so they are
reachable from the top without permanently occupying the header.

Measured trade-off, accepted with the pick: option 3 has the tallest mobile
header of the three at **452px**, which leaves **392px** of timeline above the
fold at 375 -- against 502px for option 1 and 463px for option 2. Search stays
above the fold at y=74 and nothing truncates, but the hero has the least room.

**The build must protect the hero despite that.** The timeline is the chosen
layout's hero and 392px is the tightest budget of the three, so the drawer must
be collapsed by default at 375, the header must not grow further, and at least
one full row of timeline cells plus the section heading must be visible on
arrival. Re-measure after building; if the timeline drops below roughly a third
of the mobile viewport, tighten the header rather than letting the hero shrink.

Ruled out: option 1 (command bar) leaves the most hero room but keeps the
filters as separate chrome; option 2 (two-tier) pushes mobile search down to
y=224, the weakest placement for a control the user had already reported as hard
to find.
