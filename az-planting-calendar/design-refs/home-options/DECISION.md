# Home layout options -- structural differences

**Option 1 -- Focus hero (current shipped structure):** Text-first plantable hero owns the first viewport (title, date + search, then list cards with art). Zone sits in the top bar. Assistant is an inline panel below the hero, then the year grid.

**Option 2 -- Gallery first:** Dense image tile grid dominates the first viewport. Search is sticky chrome beside the brand mark; zone is a compact pill. Assistant is a floating action button (FAB), not a panel.

**Option 3 -- Timeline + rail:** Horizontal half-month timeline is the hero (counts per half-month). Crop rows are secondary under the timeline. Zone is a full-width bar above search. Assistant is a desktop right rail (mobile: block under the list).

Separable pieces for a mix: hero type (text cards / tiles / timeline), search placement (in-hero / sticky chrome / sticky under zone bar), zone placement (topbar / pill / full bar), assistant placement (inline / FAB / rail).

## Chosen

**Option 3 -- Timeline + rail.** Chosen by the user on 2026-08-02.

Why: the product's core question is "what do I plant in this half-month", and
option 3 is the only one that puts the half-month model on screen as a control
rather than burying it in a filter. The timeline exposes counts per half-month,
so a visitor sees the shape of the planting year before reading a single row.
The docked assistant rail also replaces a floating button, which is a better
home for something that answers questions about the data being displayed.

Ruled out: option 1 (focus hero) is the current structure and does not make the
half-month model visible; option 2 (gallery first) shows the crop art best but
leads with decoration rather than the question the app exists to answer.

Carry over from the other options: option 2's larger image treatment for the
crop rows, since the 45 illustrations read poorly at the current thumbnail size.

Known defect in the option-3 mockup, not to be copied: its frames hardcode
"Last frost Mar 9 / First frost Nov 15", which are the superseded Cave Creek
dates. The build must read frost dates from D1 (Feb 20 / Dec 6 for Cave Creek).
