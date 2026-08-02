# Spec — say what the calendar covers, then cover more of Arizona

Scope: **only** `az-planting-calendar/`. No git add/commit/push, no deploy.

Inherited rules — see `rules/base-15.md` and `rules/per-app-pack.md`:

- Use strict TypeScript. Do not introduce `any`.
- Write JSDoc on every function.
- Validate every boundary input with Zod. Parameterize every D1 query.
- Real data only. No invented rows.
- Keep all user-facing copy in `src/i18n/en.ts`.
- Write `--`. Never a unicode em dash.

## The report

A user typed "Sierra Vista" and "Pinetop" into the planning zone and got nothing.
Measured against production:

```
sierra -> 0    pinetop -> 0    tucson -> 0    flagstaff -> 0    prescott -> 0
UI: "No zones match that search."
```

The app holds **8 zones, all Maricopa County low desert**, because every planting
window traces to UA Cooperative Extension az1005, which covers only that. That
restriction is correct and must not be relaxed by reusing az1005 windows
elsewhere: those towns sit well outside the low desert, so low-desert sowing
dates there would be actively harmful advice rather than merely imprecise.

Source every elevation you publish. I have NOT verified any elevation figure for
these towns this session, so none appears in this spec -- and none may appear in
the app until it is read from a real source and cited.

The defect is that the app never says any of this. "No zones match" reads as
broken software rather than as a stated coverage boundary.

## Part 1 — Tell the truth about coverage (do this regardless)

This part has no data dependency. Ship it even if Part 2 finds nothing.

- The zero-result state names the coverage: this calendar covers Maricopa County
  low desert, sourced from az1005, and lists the towns that are covered.
- When the query looks like a known Arizona place outside coverage, say so
  specifically rather than generically -- name the town and state that these
  windows are for the Maricopa low desert and do not apply there. Quote an
  elevation ONLY if you sourced and cited it; otherwise say nothing about
  elevation. Keep the list small and every entry traceable.
- The zone control's own label and the About page state the coverage boundary up
  front, so a visitor learns it before searching rather than after failing.
- Never imply a town is unsupported because of a missing feature when the real
  reason is that no authoritative source has been transcribed for it.

## Part 1b — The zone control is a dropdown AND a search

Today it is a text field only, so a visitor has to already know a covered town to
discover any of them. That is why "Sierra Vista" reads as broken: there is no way
to see what the eight options even are.

Make it a combobox with both affordances:

- **Open it and see the zones.** Clicking or focusing the control lists every
  available zone without typing anything -- grouped by source region, showing
  town, ZIP and elevation. Discovery must not require a correct guess.
- **Type to filter** across **city, ZIP, county, and state**, case-insensitive
  and partial. "85251", "scotts", "Maricopa" and "AZ" should all narrow the list.
  State matching matters once Part 2 adds regions beyond Maricopa.
- Reuse the combobox pattern already built for crop search: `role="combobox"`,
  `aria-expanded`, `aria-controls`, `aria-activedescendant`,
  `role="listbox"`/`role="option"`, arrow keys, Enter, Escape. Two comboboxes in
  one app must behave identically; a control that works differently in two places
  is worse than one that works badly in both.
- A query matching nothing shows the coverage explanation from Part 1, inside the
  open list, alongside the zones that DO exist -- never an empty popup.
- Every option >= 44px, and axe stays at 0 violations in both themes with the
  list open.

Extend `GET /api/zones?q=` to match county and state as well as city and ZIP,
Zod-validated and parameterized. Add unit tests for each match mode and a miss.

## Part 2 — Extend coverage, only where a real source exists

`extension.arizona.edu` is reachable (verified 200 on the pubs site and on the
az1005 PDF). UA Cooperative Extension publishes guidance beyond the low desert;
find the actual publications rather than assuming their identifiers.

For each candidate elevation band or county:

1. Find the real publication. Record its title, author, publication id, URL and
   retrieval date, exactly as az1005 is recorded in `SOURCES.md` today.
2. Transcribe its planting windows per crop. **Never copy az1005 windows into
   another band.** A different elevation is a different calendar; that is the
   entire reason az1005 exists as a county publication.
3. Add zones only for towns the publication actually covers, with frost dates
   and elevation sourced per town the way the existing eight are.
4. `source_granularity` already exists on the window schema -- use it when a
   source gives whole-month rather than half-month precision, instead of
   implying precision the citation does not carry.

**Add no zones for a band whose authoritative publication you could not find.**
List in your report exactly what you searched and what you failed to source.
Treat a missing zone as a limitation to state, and never fabricate one -- a
person acts on these dates in their garden.

The crop set may differ per band. Do not force the 45 low-desert crops onto
another region's calendar.

## Proof required

Report each with real output:

- Part 1: screenshots at 375 and 1280 of the zero-result state for "Sierra
  Vista", described from looking at them.
- Part 1: the About page text stating the coverage boundary.
- Part 2: for every publication used -- title, id, URL, retrieval date, and the
  HTTP status you got when you fetched it.
- Part 2: a real D1 query showing zone and window counts per source after the
  migration, applied locally and remotely.
- Part 2: an explicit list of what you searched for and failed to source.
- `npm run typecheck`, `npm run lint`, `npm test`, `npx playwright test`,
  `npm run build` -- real tails.
- Acceptance test: an out-of-coverage query renders the explanatory state, not a
  bare "no results".

Do not widen coverage by loosening the citation requirement. The INNER JOIN on
`sources` that makes an uncited window unrenderable stays exactly as it is.
