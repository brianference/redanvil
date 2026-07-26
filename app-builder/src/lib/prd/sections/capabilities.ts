import type { FeatureSpec } from '../types';

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
  kind: 'search-rank' | 'schedule' | 'track' | 'notify' | 'calculate' | 'import-export';
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
    kind: 'schedule',
    re: /\b(schedul\w*|shift\w*|roster\w*|book\w*|appointment\w*|calendar|availability|coverage)\b/i
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
 * Split the constraint tail of a prompt into individual criteria.
 *
 * Users write constraints as a comma list after "with" or "by": "with specific
 * nonstop, limit to one layover, duration of layover, arrival time, total
 * travel time optimizations". Each item is a real filter or sort control, and
 * every one of them was being discarded.
 *
 * @param prompt - Raw prompt text.
 * @returns Criteria phrases in the user's own words, de-duplicated.
 */
export function extractCriteria(prompt: string): string[] {
  const tail = /\b(?:with|by|including|based on|optimi[sz]ing for)\b([\s\S]+)/i.exec(prompt);
  if (tail === null) return [];
  const parts = (tail[1] ?? '')
    .split(/,| and (?=\w)|;/)
    .map((part) =>
      part
        .replace(/\b(specific|optimi[sz]ations?|preferences?|options?|filters?)\b/gi, '')
        .replace(/\s+/g, ' ')
        .replace(/^[\s.-]+|[\s.-]+$/g, '')
        .trim()
    )
    .filter((part) => part.length > 2 && part.length < 60);
  return [...new Set(parts)];
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
    /\b(?:find|finds|search(?:es)? for|searches|compare[s]?|track[s]?|schedul\w*|book[s]?)\s+(?:the\s+)?(?:[a-z]+\s+){0,3}?([a-z][a-z ]{2,40}?)(?:\s+(?:with|by|that|which|for|based)\b|[.,]|$)/i.exec(
      prompt
    );
  const raw = (m?.[1] ?? '')
    .replace(/\b(lowest|highest|cheapest|best|fastest|cost|price)\b/gi, '')
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
