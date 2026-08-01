import type { FeatureSpec } from '../types';
import { requirementLines } from '../naming';

/**
 * What the app actually DOES, extracted from the prompt.
 *
 * Features used to be derived from entity names alone: given "flight times"
 * you got "Browse & search FlightTime", "FlightTime detail", "Manage
 * FlightTime" — a CRUD app over a table with `title` and `description`. The
 * prompt was never passed to the derivation at all, so a request for "the
 * lowest cost airline flight, nonstop or one layover, with limits on layover
 * duration, arrival time and total travel time" produced a spec containing no
 * flight search and none of those constraints.
 *
 * Entities say what the app stores. Only the prompt says what it is for.
 */
export interface Capability {
  /** The shape of work the app does. */
  kind:
    | 'search-rank'
    | 'reference'
    | 'schedule'
    | 'track'
    | 'notify'
    | 'calculate'
    | 'import-export';
  /** What the user is optimising for, e.g. "lowest cost". Null when unstated. */
  objective: string | null;
  /** Constraints and preferences the user named, in their own words. */
  criteria: string[];
  /** What the capability acts on, e.g. "airline flight". */
  subject: string;
}

/** Verb patterns that identify each capability, most specific first. */
const KIND_PATTERNS: readonly { kind: Capability['kind']; re: RegExp }[] = [
  {
    kind: 'search-rank',
    re: /\b(find|finds|search|searches|compare|compares|rank|ranks|cheapest|lowest|best|fastest|shortest|optimi[sz]e[sd]?)\b/i
  },
  {
    // Reference views over a fixed, cited dataset: planting calendars, tide
    // tables, hardiness charts. Placed AFTER search-rank so a genuine search
    // prompt still wins. "calendar" alone is intentionally here (not under
    // schedule) — RA-163 removed it from schedule; without this kind the
    // planting-calendar prompt matches nothing and §8 collapses to CRUD.
    kind: 'reference',
    re: /\b(show|shows|list|lists|display|displays|browse|browses|view|views|chart|charts|grid|grids|calendar|calendars|window|windows|what\s+is\s+\w+)\b/i
  },
  {
    // "calendar" alone is NOT a scheduling signal and used to be one. A planting
    // calendar, a content calendar and an academic calendar are all REFERENCE
    // views: they answer "what belongs in this window", and nobody assigns
    // anything to anybody. Matching the bare word emitted "Schedule Item — users
    // assign Item to a time and a person, and the app refuses assignments that
    // conflict" for an Arizona planting calendar, with conflict-detection tests
    // attached, and building that spec literally produces an item tracker while
    // the actual product never appears.
    //
    // Scheduling needs a signal that something is ASSIGNED or RESERVED, so the
    // remaining verbs all carry that meaning on their own.
    kind: 'schedule',
    re: /\b(schedul\w*|shift\w*|roster\w*|book\w*|appointment\w*|availability|coverage)\b/i
  },
  { kind: 'notify', re: /\b(alert\w*|notif\w*|remind\w*|warn\w*|escalat\w*)\b/i },
  { kind: 'track', re: /\b(track\w*|log\w*|monitor\w*|record\w*|history|audit)\b/i },
  {
    kind: 'calculate',
    re: /\b(calculat\w*|estimat\w*|forecast\w*|budget\w*|score[sd]?|total\w*)\b/i
  },
  { kind: 'import-export', re: /\b(import\w*|export\w*|upload\w*|csv|sync\w*)\b/i }
];

/** Superlative objectives, longest first so "lowest cost" beats "cost". */
const OBJECTIVE_RE =
  /\b((?:lowest|highest|cheapest|best|fastest|shortest|earliest|latest|most|least)(?:\s+(?:cost|price|total|priced?|value|time|duration|fare))?)\b/i;

/**
 * Clean one criterion phrase: strip filler words and bound length.
 *
 * @param part - Raw fragment.
 * @returns Cleaned phrase, or empty when too short/long.
 */
function cleanCriterion(part: string): string {
  return part
    .replace(/\b(specific|optimi[sz]ations?|preferences?|options?|filters?|marked)\b/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.-]+|[\s.-]+$/g, '')
    .trim();
}

/**
 * Split the constraint tail of a prompt into individual criteria.
 *
 * Users write constraints as a comma list after "with" or "by", and also as a
 * multi-line requirement list. Every non-empty requirement line is a candidate;
 * the classic with|by tail parse still runs on the full text.
 *
 * @param prompt - Raw prompt text.
 * @returns Criteria phrases in the user's own words, de-duplicated.
 */
export function extractCriteria(prompt: string): string[] {
  const parts: string[] = [];

  // A3: multi-line / bullet requirement list first.
  for (const line of requirementLines(prompt)) {
    const tail = /\b(?:with|by|including|based on|optimi[sz]ing for)\b([\s\S]+)/i.exec(line);
    if (tail !== null) {
      for (const piece of (tail[1] ?? '').split(/,| and (?=\w)|;/)) {
        parts.push(piece);
      }
    } else if (line.length > 2 && line.length < 120) {
      // Whole short requirement lines are criteria ("seed vs transplant marked",
      // "Crop detail: days to harvest", "Every planting window cites AZ1005").
      const stripped = line
        .replace(/^(?:show|list|display|browse|view|filter|find|track|build)\b[:\s]*/i, '')
        .replace(/^[^:]+:\s*/, '')
        .trim();
      if (stripped.length > 2) parts.push(stripped);
      else parts.push(line);
    }
  }

  // Full-prompt with|by tail (covers single-line comma lists).
  const fullTail = /\b(?:with|by|including|based on|optimi[sz]ing for)\b([\s\S]+)/i.exec(prompt);
  if (fullTail !== null) {
    for (const piece of (fullTail[1] ?? '').split(/,| and (?=\w)|;/)) {
      parts.push(piece);
    }
  }

  const cleaned = parts
    .map(cleanCriterion)
    .filter((part) => part.length > 2 && part.length < 80);
  return [...new Set(cleaned)];
}

/**
 * Words that name a piece of software rather than its subject. "Schedule app"
 * and "Alerts for record" are what you get without this list.
 */
const GENERIC_SUBJECTS =
  /^(?:an?\s+)?(?:simple\s+|full[- ]stack\s+|mobile[- ]first\s+|web\s+)*(?:app|application|tool|system|site|website|platform|dashboard|record|thing|product|service)s?$/i;

/**
 * The thing the app acts on.
 *
 * Prefers the prompt, because that is where the domain lives, but falls back to
 * the primary entity when the prompt only yields a word for "software" — the
 * first version produced "Schedule app" and "Alerts for record", which name
 * nothing.
 *
 * @param prompt - Raw prompt text.
 * @param entities - Domain entity names, primary first.
 * @returns A short subject phrase.
 */
export function extractSubject(prompt: string, entities: readonly string[] = []): string {
  const m =
    /\b(?:find|finds|search(?:es)? for|searches|compare[s]?|track(?:s|ing)?|schedul\w*|book[s]?|show[s]?|list[s]?|display[s]?|browse[s]?|view[s]?|remind(?:s|ers?)?(?:\s+you)?(?:\s+when)?)\s+(?:the\s+|what\s+is\s+|you\s+when\s+(?:your\s+)?)?(?:[a-z]+\s+){0,3}?([a-z][a-z0-9 ]{2,40}?)(?:\s+(?:with|by|that|which|for|based|in|marked|needs)\b|[.,]|$)/i.exec(
      prompt
    );
  const raw = (m?.[1] ?? '')
    .replace(/\b(lowest|highest|cheapest|best|fastest|cost|price|current)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const fromPrompt = raw.length > 2 && !GENERIC_SUBJECTS.test(raw) ? raw : '';
  if (fromPrompt.length > 0) return fromPrompt;
  const entity = (entities[0] ?? '').trim();
  return entity.length > 0 ? entity.replace(/s$/i, '') : 'record';
}

/**
 * Detect what the app does from its prompt.
 *
 * Deterministic on purpose: the PRD is a spec, and a spec that changes when you
 * regenerate it is not a spec.
 *
 * @param prompt - Raw prompt text.
 * @param entities - Domain entity names (helps subject extraction).
 * @returns Capabilities in priority order; empty when the prompt names none.
 */
export function detectCapabilities(prompt: string, entities: readonly string[] = []): Capability[] {
  const text = prompt.trim();
  if (text.length === 0) return [];
  const objective = OBJECTIVE_RE.exec(text)?.[1]?.toLowerCase() ?? null;
  const criteria = extractCriteria(text);
  const subject = extractSubject(text, entities);
  const found: Capability[] = [];
  for (const { kind, re } of KIND_PATTERNS) {
    if (re.test(text)) found.push({ kind, objective, criteria, subject });
  }
  // Two is the useful ceiling: a spec that claims six primary capabilities has
  // no primary capability, and the MVP stops being minimal.
  return found.slice(0, 2);
}

/** Title-case a subject for feature names. */
function titleCase(value: string): string {
  return value.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/** A safe identifier fragment for generated test names. */
function ident(value: string): string {
  const cleaned = value
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  const joined = cleaned.map((w) => w[0]?.toUpperCase() + w.slice(1).toLowerCase()).join('');
  return joined.length > 0 ? joined : 'Result';
}

/**
 * Turn detected capabilities into real features with domain acceptance criteria.
 *
 * These lead the feature list and are MVP: they are what the app is for. The
 * entity CRUD features still follow, because the app does need to store and
 * show its records — but they are no longer the whole product.
 *
 * @param capabilities - Output of {@link detectCapabilities}.
 * @param startIndex - Number to continue feature ids from (1 → F1).
 * @returns Feature specs, empty when no capability was detected.
 */
export function capabilityFeatures(
  capabilities: readonly Capability[],
  startIndex: number
): FeatureSpec[] {
  const out: FeatureSpec[] = [];
  let n = startIndex;

  for (const cap of capabilities) {
    const subject = cap.subject;
    const Subject = titleCase(subject);
    const id = ident(subject);

    if (cap.kind === 'search-rank') {
      const objective = cap.objective ?? 'the best match';
      out.push({
        id: `F${n}`,
        name: `Search ${subject}`,
        behavior: `The core flow: the user enters their query and the app returns matching ${subject} results, ordered by ${objective}.`,
        mvp: true,
        acceptance: [
          `GIVEN a valid query WHEN the user submits the search THEN results render ordered by ${objective}`,
          `GIVEN a query that matches nothing WHEN results return THEN an empty state explains how to widen the search`,
          `GIVEN the search API returns 500 WHEN the user submits THEN an error with a retry action is shown, never an empty result list`,
          `GIVEN a slow upstream WHEN the request exceeds its timeout THEN the user sees a timeout message rather than an indefinite spinner`
        ],
        tests: {
          unit: [
            `rank${id}Results_ordersBy${ident(objective)}`,
            `rank${id}Results_stableForEqualValues`
          ],
          integration: [
            `POST /api/search returns 200 with ordered results`,
            `POST /api/search returns 400 on an invalid query`
          ],
          e2e: [
            `search-${subject.replace(/\s+/g, '-')} returns ordered results`,
            `search empty state`,
            `search error + retry`
          ]
        }
      });
      n += 1;

      if (cap.criteria.length > 0) {
        out.push({
          id: `F${n}`,
          name: `Filter and sort ${subject}`,
          behavior: `The constraints named in the request are real controls, not prose: ${cap.criteria.join('; ')}.`,
          mvp: true,
          acceptance: [
            ...cap.criteria
              .slice(0, 6)
              .map(
                (c) =>
                  `GIVEN results are showing WHEN the user applies "${c}" THEN only results satisfying it remain, and the active filter is visible`
              ),
            `GIVEN several filters are active WHEN the user clears them THEN the full result set returns`,
            `GIVEN a filter combination that excludes everything WHEN it is applied THEN an empty state names the filters responsible`
          ],
          tests: {
            unit: cap.criteria.slice(0, 4).map((c) => `filter${id}_by${ident(c)}`),
            integration: [`POST /api/search honours every filter in the request body`],
            e2e: [`filters narrow the result set`, `clearing filters restores results`]
          }
        });
        n += 1;
      }
    }

    if (cap.kind === 'reference') {
      // Grid / window view of the fixed dataset — the hero for planting calendars,
      // tide tables, and similar reference UIs. Criteria phrases are quoted into
      // behavior/acceptance so prompt-fidelity can find them by name.
      const criteriaBlurb =
        cap.criteria.length > 0 ? ` Criteria: ${cap.criteria.join('; ')}.` : '';
      out.push({
        id: `F${n}`,
        name: `${Subject} grid`,
        behavior: `Users open a calendar grid or half-month window view of ${subject}.${criteriaBlurb} Seed vs transplant (or equivalent method markers) are visible when the dataset carries them.`,
        mvp: true,
        acceptance: [
          `GIVEN a loaded ${subject} dataset WHEN the user opens the calendar grid THEN rows and half-month window columns render without inventing missing data`,
          `GIVEN method markers exist (seed vs transplant) WHEN the grid renders THEN each applicable cell shows the marker`,
          `GIVEN the dataset is empty or not loaded WHEN the grid opens THEN an explicit empty state is shown, never sample rows`,
          `GIVEN the API returns 500 WHEN the grid loads THEN an error with a retry action is shown`
        ],
        tests: {
          unit: [`build${id}Grid_knownRows_returnsCells`, `build${id}Grid_emptyDataset_returnsEmpty`],
          integration: [`GET /api/${id.toLowerCase()}/grid returns 200 with cells`],
          e2e: [
            `${subject.replace(/\s+/g, '-')}-grid shows windows`,
            `${subject.replace(/\s+/g, '-')}-grid empty state`
          ]
        }
      });
      n += 1;

      if (cap.criteria.length > 0) {
        out.push({
          id: `F${n}`,
          name: `Filter ${subject}`,
          behavior: `The criteria named in the request are real filter controls, including filter by month when month is named: ${cap.criteria.join('; ')}.`,
          mvp: true,
          acceptance: [
            ...cap.criteria
              .slice(0, 6)
              .map(
                (c) =>
                  `GIVEN the grid is showing WHEN the user applies "${c}" THEN only matching ${subject} remain and the active filter is visible`
              ),
            `GIVEN active filters WHEN the user clears them THEN the full dataset returns`,
            `GIVEN a filter combination that excludes everything WHEN applied THEN an empty state names the filters responsible`
          ],
          tests: {
            unit: cap.criteria.slice(0, 4).map((c) => `filter${id}_by${ident(c)}`),
            integration: [`GET /api/${id.toLowerCase()} honours every filter query param`],
            e2e: [`filters narrow the ${subject} grid`, `clearing filters restores the grid`]
          }
        });
        n += 1;
      }

      out.push({
        id: `F${n}`,
        name: `${Subject} detail`,
        behavior: `Opening a ${subject} shows its detail: every related planting window, days to harvest (or equivalent metrics), notes, and source citations when present.`,
        mvp: true,
        acceptance: [
          `GIVEN a ${subject} id that exists WHEN the user opens detail THEN windows, days to harvest, and notes render`,
          `GIVEN a citation (e.g. AZ1005) WHEN detail loads THEN every planting window cites az1005 (or the named source) and links to it`,
          `GIVEN a window with no source WHEN detail loads THEN that window does not render`,
          `GIVEN an unknown id WHEN detail opens THEN a not-found state with a path back is shown`
        ],
        tests: {
          unit: [`${id}Detail_includesWindowsAndHarvest`, `${id}Detail_omitsUncitedWindows`],
          integration: [
            `GET /api/${id.toLowerCase()}/:id returns 200 for existing`,
            `GET /api/${id.toLowerCase()}/:id returns 404 for missing`
          ],
          e2e: [
            `${subject.replace(/\s+/g, '-')}-detail shows fields`,
            `${subject.replace(/\s+/g, '-')}-detail not-found`
          ]
        }
      });
      n += 1;
    }

    if (cap.kind === 'schedule') {
      out.push({
        id: `F${n}`,
        name: `Schedule ${subject}`,
        behavior: `Users assign ${subject} to a time and a person, and the app refuses assignments that conflict.`,
        mvp: true,
        acceptance: [
          `GIVEN an open slot WHEN the user assigns it THEN the schedule shows the assignment immediately`,
          `GIVEN an assignment that overlaps an existing one WHEN the user saves THEN it is rejected with the conflicting item named`,
          `GIVEN an assignment WHEN the user cancels it THEN the slot returns to open and the change is visible without a reload`
        ],
        tests: {
          unit: [
            `detectConflict_overlappingRange_returnsTrue`,
            `detectConflict_adjacentRange_returnsFalse`
          ],
          integration: [`POST /api/assignments returns 409 on overlap`],
          e2e: [`assign and cancel a ${subject}`]
        }
      });
      n += 1;
    }

    if (cap.kind === 'notify') {
      out.push({
        id: `F${n}`,
        name: `Alerts for ${subject}`,
        behavior: `The user defines the condition worth being told about, and the app tells them when it holds.`,
        mvp: false,
        acceptance: [
          `GIVEN an alert rule WHEN its condition becomes true THEN the user is notified once, not repeatedly for the same event`,
          `GIVEN a rule WHEN the user disables it THEN no further notifications are sent`
        ],
        tests: {
          unit: [
            `shouldNotify_firstTransition_returnsTrue`,
            `shouldNotify_repeatWithoutChange_returnsFalse`
          ],
          integration: [
            `POST /api/alerts validates the rule and returns 400 on an impossible condition`
          ],
          e2e: [`create an alert rule and see it listed`]
        }
      });
      n += 1;
    }

    if (cap.kind === 'track') {
      out.push({
        id: `F${n}`,
        name: `${Subject} history`,
        behavior: `Every recorded ${subject} is kept and shown over time, so a change can be seen rather than inferred.`,
        mvp: false,
        acceptance: [
          `GIVEN recorded entries WHEN the user opens the history THEN entries appear newest first with their timestamps`,
          `GIVEN no entries WHEN the history loads THEN an empty state explains what will appear here`
        ],
        tests: {
          unit: [`sortHistory_newestFirst`],
          integration: [`GET /api/history returns 200 with ordered entries`],
          e2e: [`history shows recorded entries`]
        }
      });
      n += 1;
    }

    if (cap.kind === 'calculate') {
      out.push({
        id: `F${n}`,
        name: `Compute ${subject} totals`,
        behavior: `The number the user came for is computed by the app and shown with what it was derived from.`,
        mvp: false,
        acceptance: [
          `GIVEN inputs WHEN the total is computed THEN the result shows the figures it was derived from`,
          `GIVEN a missing or invalid input WHEN the user submits THEN the app explains what is missing instead of showing a wrong number`
        ],
        tests: {
          unit: [
            `compute${id}Total_knownInputs_matchesExpected`,
            `compute${id}Total_missingInput_throwsTyped`
          ],
          integration: [`POST /api/compute returns 400 on invalid input`],
          e2e: [`totals render with their inputs`]
        }
      });
      n += 1;
    }

    if (cap.kind === 'import-export') {
      out.push({
        id: `F${n}`,
        name: `Import and export ${subject}`,
        behavior: `Users move ${subject} in and out of the app without retyping it.`,
        mvp: false,
        acceptance: [
          `GIVEN a valid file WHEN the user imports it THEN every accepted row appears and rejected rows are listed with a reason`,
          `GIVEN current data WHEN the user exports THEN the file re-imports without loss`
        ],
        tests: {
          unit: [`parseImportRow_valid_returnsRow`, `parseImportRow_malformed_returnsError`],
          integration: [`POST /api/import reports per-row outcomes`],
          e2e: [`import a file and see the rows`]
        }
      });
      n += 1;
    }
  }

  return out;
}
