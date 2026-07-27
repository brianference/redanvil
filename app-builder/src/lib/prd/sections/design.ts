/**
 * Design direction: the part of the spec that makes two generated apps look
 * like two different products.
 *
 * Everything else in §7.3 is a constraint — token-only colour, 44px targets, AA
 * contrast, a sticky shell, the five required routes. Constraints are necessary
 * and they are also identical for every app, so an agent handed only those
 * builds the same centred-column-under-a-sticky-header page every single time.
 * The rules were doing their job; nothing was asking for a different product.
 *
 * So this picks a **layout archetype** (a structurally different app shell, not
 * a recolour) and a **visual direction** (type pairing, shape language, density,
 * colour character), and states plainly what the app must NOT default to.
 *
 * The choice is derived from the app's own inputs rather than randomised. Two
 * runs of the same prompt produce the same design — the PRD is a spec, and a
 * spec that changes when you regenerate it is not a spec — while two different
 * prompts land in different places.
 */

/** A structurally distinct app shell. */
export interface LayoutArchetype {
  /** Short name used in the spec. */
  readonly name: string;
  /** What makes this structurally different from the others. */
  readonly structure: string;
  /** ASCII skeleton at desktop width. */
  readonly desktop: readonly string[];
  /** How the same structure resolves at 375px. */
  readonly mobile: string;
  /** The kind of product this shell actually suits. */
  readonly suits: string;
}

/**
 * Eight shells that differ in where navigation lives, how the primary surface is
 * divided, and what the user's eye lands on first. Recolouring one does not
 * produce another, which is the bar the mockup rule sets for "distinct".
 */
export const LAYOUT_ARCHETYPES: readonly LayoutArchetype[] = [
  {
    name: 'Split workbench',
    structure:
      'Persistent left list, detail on the right, no full-page navigation between records.',
    desktop: [
      '┌──────────────── sticky top bar ────────────────┐',
      '│ brand      search              actions  theme  │',
      '├───────────────┬────────────────────────────────┤',
      '│ record list   │  selected record               │',
      '│ (scrolls,     │  (scrolls independently)       │',
      '│  stays put)   │                                │',
      '└───────────────┴────────────────────────────────┘'
    ],
    mobile: 'List is the page; tapping a row pushes the detail as a full screen with a back link.',
    suits: 'triage, inboxes, anything where the user compares records without losing their place'
  },
  {
    name: 'Command canvas',
    structure:
      'One large working surface; everything else collapses into a command bar and a slide-over.',
    desktop: [
      '┌────────────────────────────────────────────────┐',
      '│  ⌘ command bar (focus on load, / to reopen)    │',
      '├────────────────────────────────────────────────┤',
      '│                                                │',
      '│            the work itself, full bleed         │',
      '│                                                │',
      '├────────────────────────────────────────────────┤',
      '│  contextual actions appear only when relevant  │',
      '└────────────────────────────────────────────────┘'
    ],
    mobile: 'Command bar becomes a sticky bottom sheet handle; the canvas keeps the full viewport.',
    suits: 'creation tools, editors, anything where chrome competes with the work'
  },
  {
    name: 'Timeline chronicle',
    structure: 'A single vertical spine ordered by time, with events hung off it. No card grid.',
    desktop: [
      '┌────────────────────────────────────────────────┐',
      '│ sticky period filter · today / week / all      │',
      '├────────────────────────────────────────────────┤',
      '│   │  ● 09:14  event, its detail inline         │',
      '│   │  ● 11:02  event                            │',
      '│   ├─ Tuesday ───────────────────────────       │',
      '│   │  ● 16:40  event                            │',
      '└────────────────────────────────────────────────┘'
    ],
    mobile: 'Spine moves to the left gutter; date separators become sticky sub-headers.',
    suits: 'logs, histories, journals, anything where "when" is the primary axis'
  },
  {
    name: 'Metric board',
    structure: 'Numbers first: a dense KPI band above a sortable table. Reading beats navigating.',
    desktop: [
      '┌────────────────────────────────────────────────┐',
      '│ ┌────┐ ┌────┐ ┌────┐ ┌────┐  ← KPI band        │',
      '│ └────┘ └────┘ └────┘ └────┘                    │',
      '├────────────────────────────────────────────────┤',
      '│ sortable table, sticky header row              │',
      '│ column filters, row density toggle             │',
      '└────────────────────────────────────────────────┘'
    ],
    mobile: 'KPI band scrolls horizontally as snap cards; the table becomes stacked record cards.',
    suits: 'reporting, monitoring, admin — where the answer is a number, not a page'
  },
  {
    name: 'Guided flow',
    structure: 'One decision per screen with visible progress. The app is a path, not a place.',
    desktop: [
      '┌────────────────────────────────────────────────┐',
      '│  ●───●───○───○   step 2 of 4                   │',
      '├────────────────────────────────────────────────┤',
      '│        one question, stated large              │',
      '│        the controls to answer it               │',
      '│        [ Back ]            [ Continue ]        │',
      '└────────────────────────────────────────────────┘'
    ],
    mobile: 'Identical, with the action pair pinned above the safe-area inset.',
    suits: 'intake, configuration, onboarding — where a wrong order produces a wrong result'
  },
  {
    name: 'Focus hero',
    structure:
      'One dominant object with everything else subordinate; secondary content sits below the fold.',
    desktop: [
      '┌────────────────────────────────────────────────┐',
      '│                                                │',
      '│        the one thing that matters now          │',
      '│        with its single primary action          │',
      '│                                                │',
      '├────────────────────────────────────────────────┤',
      '│  supporting detail, deliberately below         │',
      '└────────────────────────────────────────────────┘'
    ],
    mobile: 'The hero owns the first viewport; supporting detail begins exactly at the fold.',
    suits: 'single-purpose tools, "what do I do next" apps, status pages'
  },
  {
    name: 'Kanban lanes',
    structure: 'Horizontal columns by state; movement between columns IS the primary interaction.',
    desktop: [
      '┌────────────────────────────────────────────────┐',
      '│ ┌────────┐┌────────┐┌────────┐┌────────┐       │',
      '│ │ To do  ││ Doing  ││ Review ││ Done   │       │',
      '│ │ ┌────┐ ││ ┌────┐ ││        ││ ┌────┐ │       │',
      '│ │ └────┘ ││ └────┘ ││        ││ └────┘ │       │',
      '│ └────────┘└────────┘└────────┘└────────┘       │',
      '└────────────────────────────────────────────────┘'
    ],
    mobile: 'One lane per screen with a segmented control; move actions live in the row menu.',
    suits: 'work that has states and moves between them'
  },
  {
    name: 'Map + list',
    structure:
      'A spatial surface paired with a synchronised list; selecting in one drives the other.',
    desktop: [
      '┌────────────────────────────────────────────────┐',
      '│                              ┌───────────────┐ │',
      '│        spatial surface       │ synced list   │ │',
      '│        (map / floorplan /    │ hover ↔ pin   │ │',
      '│         seating / chart)     │               │ │',
      '│                              └───────────────┘ │',
      '└────────────────────────────────────────────────┘'
    ],
    mobile: 'Surface takes the top 45vh; the list is a draggable sheet over it.',
    suits: 'anything with location or physical arrangement'
  }
];

/** A visual character: type, shape, density, colour. */
export interface VisualDirection {
  readonly name: string;
  /** Heading + body pairing, both web-safe or Google-hosted. */
  readonly type: string;
  /** Corner radius, borders, elevation. */
  readonly shape: string;
  /** Spacing rhythm. */
  readonly density: string;
  /** How colour is used — still token-driven and still AA. */
  readonly colour: string;
}

/**
 * Six directions that read differently at a glance. None of them changes the
 * rules — tokens only, AA contrast, 16px body floor, 44px targets — they change
 * what the tokens are set to and how much room things get.
 */
export const VISUAL_DIRECTIONS: readonly VisualDirection[] = [
  {
    name: 'Editorial',
    type: 'A serif for headings (Fraunces, Newsreader) against a plain grotesque body.',
    shape: 'Square corners, hairline rules instead of borders, no shadows.',
    density: 'Generous: large line-height, wide margins, few elements per screen.',
    colour: 'Near-monochrome with one ink accent; colour marks meaning, never decorates.'
  },
  {
    name: 'Technical',
    type: 'A grotesque throughout, with a mono face for all numbers, ids and timestamps.',
    shape: 'Small radius (4px), visible 1px borders, flat surfaces.',
    density: 'Tight: compact rows, small gaps, high information per screen.',
    colour: 'Cool neutrals with saturated status colours that carry a shape or label too.'
  },
  {
    name: 'Soft product',
    type: 'One humanist sans (Inter, Public Sans) across the whole scale.',
    shape: 'Large radius (12-16px), soft shadow, no hard borders.',
    density: 'Comfortable: roomy cards, clear grouping, moderate element count.',
    colour: 'A warm brand hue used at low saturation for surfaces, full strength only on the CTA.'
  },
  {
    name: 'Brutal utility',
    type: 'A single heavy grotesque; size and weight do all the hierarchy work.',
    shape: 'Zero radius, thick 2px borders, hard offset shadows.',
    density: 'Blocky: big hit areas, strong separation, little decoration.',
    colour: 'High-contrast black/white with one loud accent. Nothing subtle.'
  },
  {
    name: 'Calm clinical',
    type: 'A neutral sans with tabular figures wherever numbers align.',
    shape: 'Medium radius (8px), very light borders, minimal elevation.',
    density: 'Even: a consistent 8px rhythm with no dramatic size jumps.',
    colour: 'Desaturated blues and greys; a single amber/red reserved strictly for attention.'
  },
  {
    name: 'Expressive dark',
    type: 'A geometric sans for headings, neutral sans for body.',
    shape: 'Pill controls, gradient-edged surfaces, glow instead of drop shadow.',
    density: 'Cinematic: large hero type, deliberate empty space, few competing elements.',
    colour: 'Dark-first with a luminous accent; the light theme is a real design, not an inversion.'
  }
];

/**
 * Stable 32-bit hash (FNV-1a) so the same inputs always choose the same design.
 *
 * @param input - Seed string.
 * @returns Unsigned 32-bit hash.
 */
export function designHash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** The chosen direction for one app. */
export interface DesignDirection {
  readonly archetype: LayoutArchetype;
  readonly visual: VisualDirection;
  /** Archetypes explicitly ruled out, so the agent cannot fall back to them. */
  readonly rejected: readonly string[];
}

/**
 * Choose a layout archetype and visual direction from the app's own inputs.
 *
 * Deterministic on purpose: a spec that changes every time you regenerate it is
 * not a spec. The two axes are seeded differently so a given layout is not
 * welded to a given visual style across apps.
 *
 * @param seed - Stable app inputs (prompt + app type + entities).
 * @returns The chosen direction plus the shells it must not fall back to.
 */
export function chooseDesignDirection(seed: string): DesignDirection {
  const h = designHash(seed);
  const archetype = LAYOUT_ARCHETYPES[h % LAYOUT_ARCHETYPES.length] as LayoutArchetype;
  const visual = VISUAL_DIRECTIONS[
    designHash(`visual:${seed}`) % VISUAL_DIRECTIONS.length
  ] as VisualDirection;
  const rejected = LAYOUT_ARCHETYPES.filter((a) => a.name !== archetype.name)
    .slice(0, 3)
    .map((a) => a.name);
  return { archetype, visual, rejected };
}

/**
 * Render the design-direction section of the PRD.
 *
 * @param seed - Stable app inputs (prompt + app type + entities).
 * @returns Markdown for §7.3a.
 */
export function buildDesignDirection(seed: string): string {
  const { archetype, visual, rejected } = chooseDesignDirection(seed);
  return [
    'The constraints in §7.3 are identical for every app RedAnvil generates. They are not a',
    'design. This section is, and it is **binding**: an implementation that satisfies every',
    'constraint while looking like a generic centred column under a sticky header has not built',
    'this spec.',
    '',
    `#### Layout archetype — ${archetype.name}`,
    '',
    `${archetype.structure}`,
    '',
    '```',
    ...archetype.desktop,
    '```',
    '',
    `**At 375px:** ${archetype.mobile}`,
    '',
    `**Why this shell:** ${archetype.suits}.`,
    '',
    `**Do not fall back to:** ${rejected.join(', ')}. Those are different products. If this`,
    'archetype genuinely does not fit the domain, say so in the PR and argue for another one —',
    'do not quietly build a centred list instead.',
    '',
    `#### Visual direction — ${visual.name}`,
    '',
    `- **Type:** ${visual.type}`,
    `- **Shape:** ${visual.shape}`,
    `- **Density:** ${visual.density}`,
    `- **Colour:** ${visual.colour}`,
    '',
    'This direction sets what the tokens are, not whether to use them. Every constraint in §7.3',
    'still holds: semantic tokens only, AA contrast measured with axe-core, a 16px body floor,',
    '44px touch targets, a real light theme and a real dark theme.',
    '',
    '#### Before you write components',
    '',
    '> The archetype and direction above are a **starting hypothesis, not a decision** (R24).',
    '> They were derived from the prompt, and nobody has chosen them yet. Do not implement',
    '> them straight through — the two steps below come first, and they are blockers.',
    '',
    "- [ ] **Run the App Store intake (R23).** Search the real store by this app's own domain",
    '      keywords and look at what shipped in the category:',
    '      `node ~/.claude/skills/design-inspo-x/scripts/appstore_refs.mjs --terms "<domain',
    '      keywords>" --out design-refs/<slug>`. It ranks by rating count and writes',
    '      `SOURCES.md`. **No `SOURCES.md` means this step did not run.** Then name, per app,',
    '      the ONE component you are borrowing, and change its shape, density or position.',
    '      Never take a brand mark, palette, or a whole screen layout.',
    '- [ ] **Present options and let the user pick (R24).** Minimum three, structurally',
    '      distinct — if editing a palette turns one into another, it is one option. Every',
    '      option renders dark AND light at 375 in a gallery, and the folder and the gallery',
    '      both get opened. Expect the answer to be a MIX of options, so design them to blend.',
    "      Accent colour, default theme, which view lands first, and the logo are the user's",
    '      calls — never decide them silently.',
    '- [ ] Generate the logo and any backgrounds/icons in THIS phase, review every one by eye,',
    '      and say plainly which are unusable. Never iterate a brand mark against a deployed site.',
    '- [ ] Build the token set for the chosen direction FIRST, then the shell, then screens.',
    '      Choosing colours while writing components is how everything drifts back to default.',
    '- [ ] Sketch the archetype at 375 and 1280 before implementing. If the mobile resolution is',
    '      "the same thing but narrower", the archetype has not actually been applied.',
    '',
    '#### Do not copy RedAnvil',
    '',
    "RedAnvil's own app-builder and dashboard are reference *implementations of the rules*, not a",
    'template to reproduce. Reusing their shell, palette, or component structure is the specific',
    'failure this section exists to prevent.'
  ].join('\n');
}
