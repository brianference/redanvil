# The house standard (living)

What "good" means here, derived from real decisions and real rejections rather
than from taste in general. Every line traces to something that happened, so a
reviewer can challenge any of it.

`user-refuse` and `qa-visual` read this file. It is the standard they judge
against, and it is what gives a refusal its authority: not opinion, but a
recorded preference the user has already stated or demonstrated.

---

## 1. Authority

`user-refuse` **may refuse a build that passes every mechanical rule**, and a
refusal blocks the finish line at any score. Only a recorded human decision
overrides it -- never another agent, never the PM.

That authority exists because of a measured fact: in the 2026-08-02 session,
twelve design rules passed green while the user found, by looking, that search
was invisible, the logo was three times too small, spring was unreachable, the
zone control explained nothing, and there were no crop guides. Rules measured
what they were told to. Nobody was assigned to be unimpressed.

---

## 2. Three options, always, and built to blend

- Never one mockup. **Three structurally distinct options** for every surface:
  logo, home layout, header/search, footer, inner pages, components.
- Structurally distinct means recolouring one does not produce another. Vary the
  layout architecture, not the palette.
- Every option renders **dark and light at 375 and 1280**, in a multi-column
  gallery, and the folder and the gallery both get opened.
- **Expect a mix.** The answer is routinely "layout of 3, tiles of 2", so design
  options to blend and state in `DECISION.md` which pieces are separable.
- The pick is the user's. Accent colour, default theme, which view lands first,
  and the logo are never decided silently.

Observed: three home layouts (chose Timeline + rail), three examples-page
treatments (chose Card catalog), three headers (chose Compact drawer + dock).
Every single one went to a pick.

## 3. What gets chosen, and why

Three picks, one pattern: **the data model becomes a visible control.**

- *Timeline + rail* over a focus hero -- because the half-month strip with counts
  puts the model on screen instead of hiding it in a filter.
- *Card catalog* over a story stack -- equal-weight cards so no entry is buried.
- *Compact drawer + dock* over a command bar -- one integrated chrome rather than
  five stacked bands, filters and assistant raised to the top.

Prefer designs that expose structure and keep controls reachable. Reject designs
that lead with decoration.

## 4. Controls must be alive

- **A control whose result is off-screen is broken**, no matter what the rules
  say. Search sat at y=327 and rendered its result at y=1942; the report was
  "the search doesn't appear to work". Results go beside the input.
- Text inputs get **autocomplete** over the real data, with the item's image in
  the suggestion, and a proper combobox so the keyboard works.
- Give a **visible submit button** *and* make Enter submit. Both reach the same
  state.
- A selector must be **browsable, not only typeable** -- open it and see the
  options. "I can't type Sierra Vista" was really "I cannot discover what exists".
- Search across every sensible key: name, id, city, ZIP, county, state.
- Nothing truncates. An ellipsis is a defect, placeholders included.

## 5. Density, evidence, and traceability

Both reference apps show the same instinct: information-dense, and every number
traceable to where it came from.

- Mono for numbers, ids, dates and codes; a grotesque for prose.
- **Show the source inline.** Every planting window cites az1005; every fare
  shows its provider and capture date. If it cannot be cited, it does not render
  (an INNER JOIN, not a nullable column).
- State the boundary of what is covered, in the product, before the user hits it.
- A failure never renders as a clean empty success. "No provider configured" is
  said out loud rather than shown as zero results.
- Detail pages link out to real, resolving resources.

## 6. Substance over floors

- Legal pages: **>= 1400 words, >= 14 sections**, with required topic coverage.
  The old 150-word floor was rejected on sight as "a few short sentences".
- Showcase entries get a real **"What it does"** breakdown -- grouped capability
  sections, each bullet a concrete behaviour, closing with measured numbers and
  the date they were measured.
- No marketing adjectives. Describe behaviour.

## 7. Imagery

- **Real generated raster art. Never emoji, never a placeholder, never a
  gradient block.** Per-item imagery where items are browsed -- all 45 crops got
  an illustration.
- **Size art to the discrimination task.** Thumbnails made beans, okra and
  yardlong read as the same green shape; if the reader must tell items apart,
  the art must be large enough to do it.
- The brand mark renders **>= 72px at 1280** and **>= 48px at 375**. 32–56px was called "way too small";
  96px was right.
- **Never delete the brand's defining element to fix a rendering problem.** The
  calendar behind the cactus was keyed away to solve a plate on the dark header,
  which removed the calendar from a planting calendar. Fix the rendering.
- Review every generated image by eye before use, and say which were rejected.

## 8. Tone

- Plain, direct, behaviour-first. No banned words, `--` not unicode em dashes,
  sentence-case headings.
- Say what is not done, plainly, rather than reporting intent as completion.

---

## How a refusal is written

`user-refuse` cites the clause it is refusing under. A refusal reading
"section 4: the result of the primary control renders at y=1942, below a 900px
fold" is actionable and hard to argue with. "It feels unfinished" is not, and is
not acceptable output.
