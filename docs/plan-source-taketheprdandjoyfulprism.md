# Fix PRD generation, then build the planting calendar app

## Context

A prompt asking for an Arizona planting calendar — "show what is plantable in the current
half-month window, seed vs transplant marked", a 24-column year grid, crop detail with days to
harvest, filters, and an AZ1005 citation on every window — was submitted to the RedAnvil
app-builder. It came back as a generic item tracker: `entities: ["Item"]`, an `items` table with
`title`/`description`, `/items` routes, and an `F1 — Schedule Item` feature with
conflict-detection tests. Nothing in that spec is a planting calendar. Following it literally
produces a CRUD app while the product the user asked for never appears.

`de46ee9` (RA-163) already removed the misfire that produced `F1 — Schedule Item`: "calendar" is
no longer a scheduling keyword. But that fix only deleted a wrong answer. Re-checking the prompt
against the current `KIND_PATTERNS` (`app-builder/src/lib/prd/sections/capabilities.ts:28-55`),
its verbs — *show*, *filter*, *cite* — match **no** capability kind, so today the same prompt
yields **zero** capability features and §8 collapses to pure entity CRUD. The spec gets quieter,
not more correct.

And §14 graded that document **12/12 (100%)**. `selfCheck.ts` measures structure — frontmatter
present, slices have verify commands, sections in order — and never asks whether the document
describes the app that was requested. A PRD self-check that passes at 100% on a spec for the
wrong product is the defect that matters most.

So: fix the generator, then use the fixed generator to produce a real spec, then build the app.

## Data sourcing — resolved by probing, not assumption

The app's entire promise is real planting windows citing AZ1005 (*Vegetable Planting Calendar for
Maricopa County*, Kai Umeda, University of Arizona Cooperative Extension, 2018 revision). I probed
what this environment can actually reach:

| Host | Result |
|---|---|
| `raw.githubusercontent.com` | **200** — serves arbitrary public repo files |
| `api.github.com` | 200 root, but **repo-scoped**: search and arbitrary repos are refused |
| `extension.arizona.edu`, `repository.arizona.edu` | proxy `CONNECT tunnel failed, 403` |
| `almanac.com`, `web.archive.org`, `wikipedia.org`, `openfarm.cc`, `phzmapi.org` | blocked |

The network policy is GitHub-only. So I searched GitHub for a substitute and checked the
candidates directly:

- **`heydenberk/gardening-data`** — its `plantings` field is `{depth, spacing, duration}`. No
  calendar windows, no region. Not a planting calendar.
- **`Digitiain/open-plant-data`** — spacing, soil, pollinators; UK-oriented, no regional windows.
- **`waldoj/frostline`** — USDA hardiness zones per ZIP, but no per-ZIP JSON is committed (`404`
  on `zips/85331.json`) and `phzmapi.org` is blocked.

None can honor "every planting window cites az1005", and substituting one would be worse than
useless here: **low-desert Arizona planting is bounded by summer heat, not winter frost.** A
frost-date-derived dataset places tomatoes in June in Phoenix. That inversion is precisely why
AZ1005 exists as a separate county publication, and why the prompt named it.

**Therefore:** the dataset comes from you — paste the AZ1005 crop table into chat, or drop the PDF
into the repo — and I transcribe it into a sourced seed migration with a per-row citation. It is
roughly 40 crops × 12–24 columns; one paste. Everything else in this plan proceeds without it.
No crop rows get invented, and the app fails closed on an unloaded dataset (below).

## Assumptions (stated, not asked — change any and I'll adjust)

- **Name:** *Desert Planting Calendar*, slug `desert-planting-calendar`. The generated slug
  (`show-what-is-plantable-in-the-current-half-month`) is the deployed hostname and appears in
  every gate command in the document.
- **Grid stays 24 half-month columns** as requested. Each window records the granularity its
  source actually supports, so a monthly source renders as both halves of that month and the UI
  says so, rather than implying precision AZ1005 does not carry.
- **Cave Creek is not Phoenix.** Cave Creek sits near 2,200 ft against Phoenix's ~1,100 ft, so
  AZ1005's county-level dates run early there. The app states this rather than presenting county
  dates as local.

## Part A — Fix the PRD generator

All paths under `app-builder/src/lib/`. Every change keeps `generatePrd` deterministic (same
answers → same document) and each gets a test in the adjacent `*.test.ts`; the characterization
fixtures in `prd.characterization.fixtures/` will need re-recording.

### A1. Stop inventing a noun when `entities` is empty — *the open item from RA-163*

`generate.ts:71` falls back to `['Item']`, and that single default cascades into the `items`
table, `title`/`description` columns, `/items` routes, and every generated test name. The same
fallback repeats at `features.ts:35-36`, `features.ts:293`, `features.ts:315-317`, and
`naming.ts:97`.

Add `deriveEntities(prompt): string[]` to `naming.ts` — pull capitalised and repeated domain nouns
from the prompt (here: Crop, PlantingWindow, Zone). When nothing is derivable, **fail closed**:
return `[]` and have `generate.ts` emit an explicit unresolved-entities error rather than a
document. Base-15 #15 already says unknown state is an explicit error, and §7.2 shipping `items`
is exactly the silent success that rule forbids. Route the single fallback through one helper so
the five call sites cannot drift.

### A2. Add a `reference` capability kind — *what RA-163 left missing*

`capabilities.ts:18` enumerates `search-rank | schedule | track | notify | calculate |
import-export`. A reference view over a fixed, cited dataset — planting calendars, content
calendars, tide tables, hardiness charts — is not any of those, which is why this prompt now
detects nothing.

Add `kind: 'reference'` with patterns for `show|list|display|browse|view|chart|grid|calendar|
what is <adjective>|window`, placed **after** `search-rank` so a genuine search prompt still wins.
Give it a `capabilityFeatures` branch emitting: a grid/window view of the dataset, a filter
feature built from the criteria, and a detail view — each with GIVEN/WHEN/THEN acceptance in the
existing shape. Keep RA-163's tests green: booking, rostering and availability prompts must still
detect `schedule`, and a planting calendar must still **not**.

### A3. Read multi-line prompts as a requirement list

This prompt is six requirement lines plus a parenthetical and a URL, and the generator treats it
as one blob. `extractCriteria` (`capabilities.ts:73`) only looks for a `with|by` tail, so every
line after the first is discarded.

Split on newlines and bullet markers first; treat each non-empty line as a candidate requirement,
and feed those to criteria extraction alongside the existing tail parse.

### A4. Strip generator directives and URLs from product prose

§2 currently renders the raw prompt including `reverse engineer features from this
https://www.almanac.com/...` — an instruction *to the generator* presented as the product's
problem statement. Strip trailing `reverse engineer|based on|like this|see <url>` clauses and bare
URLs from §1/§2, and carry them into §7 as a named reference instead.

### A5. Delete hardcoded domain filler

- `generate.ts:150-154` appends "The cost of missing a due item is real-world failure (missed
  care, lost data, or repeated manual chase)" to **every** problem statement. It is prose about a
  reminder app. Derive from the detected capability or omit.
- `scope.ts:47` hardcodes the role `'pet owner or end user'` — a leftover from a dog-grooming
  prompt. Latent here only because `appType` contains "mobile"; wrong for any other no-auth app.
  Derive the role from the subject.

### A6. Title and slug should name a product, not truncate a sentence

`titleFromPrompt` (`naming.ts:48`) takes the first 72 chars, `slugFromPrompt` (`job.ts:162`) the
first 49, so a multi-line prompt yields "Show What Is Plantable In the Current Half Month Window
Seed Vs". `generate.ts:53` already documents this exact failure for the flight app and added an
`appName` override — but the wizard still lets a PRD forge with no name. Derive a short noun
phrase from the first line's subject, and gate Forge on a name when the derived title is a
fragment (ends mid-clause, or exceeds ~6 words with no verb).

### A7. Grade prompt fidelity, not just structure — *the highest-value change*

Add a `prompt-fidelity` check to `selfCheck.ts`: split the prompt into requirement lines (A3),
and assert each line's head noun phrase appears in at least one feature name, behavior, or
acceptance bullet. Report unmatched lines by name in §14. On this PRD it would have failed on
*seed vs transplant*, *half-month window*, *days to harvest*, *filter by month*, and *cites
az1005* — five of six lines — instead of printing 100%.

This is the check that turns the whole class of failure from silent into visible, so it should
land even if other items slip.

## Part B — The Desert Planting Calendar PRD

Regenerate with the fixed generator, then hand-finish domain specifics the generator cannot know.
Save to `docs/prd-desert-planting-calendar.md`.

**Entities** (replacing `Item`):

| Entity | Purpose |
|---|---|
| `Crop` | name, family, days to harvest (min/max), notes |
| `PlantingWindow` | crop, method (`seed`\|`transplant`), start/end half-month index (0–23), source citation, source granularity |
| `Zone` | region label, county, elevation, frost dates; default **Cave Creek, AZ (Maricopa County)** |
| `Source` | publication id (`az1005`), title, author, year, URL |

**Features** — every one traceable to a prompt line:

- **F1 Plantable now** — the current half-month window, seed vs transplant marked. *Focus hero*
  archetype (§7.3a) makes this the one dominant object.
- **F2 Year grid** — crops down, 24 half-month columns across; the hard responsive problem, since
  a 24-column table must survive 375px.
- **F3 Crop detail** — every planting window plus days to harvest.
- **F4 Filters** — by month and by seed/transplant.
- **F5 Citations** — every window links to AZ1005; a window with no source does not render.

**Section fixes the generator can't derive:** real §2 (desert planting timing is unforgiving and
the authoritative table is a PDF nobody carries into the garden); §5 non-goals — no weather API,
no user gardens, no reminders, and no zones beyond Maricopa low desert until sourced; drop the
unrequested **Email** integration currently in §7.1 and §5 unless it was a deliberate wizard
answer.

**Sourcing and licence, stated in the PRD:** AZ1005 is the sole data source and every window
cites it. The almanac URL in the prompt is an **information-architecture reference only** — its
compiled dates are not copied. This matches R23's existing rule: name the one component borrowed
and change its shape; never take a whole screen layout.

## Part C — Build the app

Scaffold and drive through the existing loop, per `docs/live-run-walkthrough.md`:

```bash
npx tsx orchestrator/src/cli.ts scaffold job.json ../desert-planting-calendar \
  --prd docs/prd-desert-planting-calendar.md
npm run gate -- ../desert-planting-calendar --threshold 90
```

Slices follow §11 of the new PRD. Two deserve calling out:

- **Slice 2 (data)** is gated on receiving AZ1005. Until the transcription lands, the app renders
  an explicit *dataset not loaded* state — never sample crops. A planting calendar showing
  invented dates is worse than one showing none, and the scaffold's unwritten-document marker
  already exists so that leaving it in place fails the gate rather than passing.
- **Slice 3 (year grid)** carries the real design risk: 24 columns at 375px against the §7.3
  no-overflow rule and the ≥80% painted-width desktop blocker.

Before components, §7.3a's blockers apply and are not optional: prior-art pass (`SOURCES.md`,
`INTEGRATIONS.md`, `COMPETITORS.md`), real Terms/Privacy/About/Contact via `legal-pages`, brand
mark via `brand-logo`, App Store intake, and three structurally distinct options presented for a
pick before any of it is built.

**Loop caveat:** the Grok harness calls an external API, and this environment reaches GitHub only.
If the xAI endpoint is blocked, the loop cannot drive Grok and I build the slices inline instead —
the gate is unaffected either way, since it runs locally and is the only signal that counts.

## Verification

**Part A** — from repo root:

```bash
npm run typecheck && npm run lint && npm test
```

New/updated tests: `capabilities.test.ts` (reference kind detected for this prompt; booking,
rostering and availability still detect `schedule`; a planting calendar still does not), plus
cases for empty-entity fail-close, multi-line splitting, directive stripping, and prompt fidelity.
Re-record `prd.characterization.fixtures/` and confirm the diffs are the intended ones —
especially `empty-entities-no-auth.json`, which encodes today's wrong behavior.

**The regression that proves it:** feed the exact planting-calendar prompt through `generatePrd`
and assert the output contains no `items` table, no `Schedule Item` feature, and a §14 fidelity
line naming zero unmatched requirements. Add it as a fixture so it cannot silently regress.

**Part B** — `npx tsx app-builder/scripts/gen-sample-prd.mts` with the real prompt; read §8/§9
and confirm every feature traces to a prompt line.

**Part C** — the app's own gate at ≥90 with zero tier-1 blockers, plus screenshots at
375/768/1280 in both themes and axe with zero serious/critical.

## Open item

AZ1005's granularity is unresolved: one search result describes whole-month columns with S/T
markers and a time-to-harvest column, another describes half-month columns. This decides whether a
window is stored at half-month or month precision. I could not open the PDF to settle it, so the
schema carries a per-window `source_granularity` and the question stays open until AZ1005 is in
hand — rather than the grid asserting a precision its citation may not support.
