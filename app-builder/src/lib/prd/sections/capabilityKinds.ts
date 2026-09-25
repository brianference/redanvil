/**
 * Capability kinds and the prompt signals that identify each one.
 * Scored and ranked by detectCapabilities in ./capabilities.ts.
 */

/**
 * What the app actually DOES, extracted from the prompt.
 *
 * Entity names alone say what the app stores, not what it is for: from "flight
 * times" they give "Browse & search FlightTime", a CRUD app over a table, and a
 * request for "the lowest cost airline flight, nonstop or one layover" would get
 * no flight search and none of its constraints. The prompt says what it is for.
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

/**
 * One distinct signal for a capability kind.
 *
 * Score is the count of these that hit a non-negated clause, so "appointments"
 * (one scheduling signal) loses to "tracks" plus "history" (two tracking
 * signals) whatever order the kinds are listed in.
 */
export interface KindRule {
  /** Capability this signal group identifies. */
  kind: Capability['kind'];
  /** Each pattern counts at most once, however often it matches. */
  signals: readonly RegExp[];
}

/**
 * Signals for each capability.
 *
 * "calendar" is a reference signal, not a scheduling one. A planting calendar
 * answers "what belongs in this window"; nobody assigns anything. Scheduling
 * needs a verb that means assigned or reserved on its own.
 */
export const KIND_RULES: readonly KindRule[] = [
  {
    kind: 'search-rank',
    signals: [
      /\bfinds?\b/i,
      /\bsearch(?:es)?\b/i,
      /\bcompares?\b/i,
      /\branks?\b/i,
      /\bcheapest\b/i,
      /\blowest\b/i,
      /\bbest\b/i,
      /\bfastest\b/i,
      /\bshortest\b/i,
      /\boptimi[sz]e[sd]?\b/i
    ]
  },
  {
    kind: 'reference',
    signals: [
      /\bshows?\b/i,
      /\blists?\b/i,
      /\bdisplays?\b/i,
      /\bbrowses?\b/i,
      /\bviews?\b/i,
      /\bcharts?\b/i,
      /\bgrids?\b/i,
      /\bcalendars?\b/i,
      /\bwindows?\b/i,
      /\bwhat\s+is\s+\w+\b/i
    ]
  },
  {
    kind: 'schedule',
    signals: [
      /\bschedul\w*\b/i,
      /\bshift\w*\b/i,
      /\broster\w*\b/i,
      /\bbook\w*\b/i,
      /\bappointment\w*\b/i,
      /\bavailability\b/i,
      /\bcoverage\b/i
    ]
  },
  {
    kind: 'notify',
    signals: [/\balert\w*\b/i, /\bnotif\w*\b/i, /\bremind\w*\b/i, /\bwarn\w*\b/i, /\bescalat\w*\b/i]
  },
  {
    kind: 'track',
    signals: [
      /\btrack\w*\b/i,
      /\blog\w*\b/i,
      /\bmonitor\w*\b/i,
      /\brecord\w*\b/i,
      /\bhistory\b/i,
      /\baudit\b/i
    ]
  },
  {
    kind: 'calculate',
    signals: [
      /\bcalculat\w*\b/i,
      /\bestimat\w*\b/i,
      /\bforecast\w*\b/i,
      /\bbudget\w*\b/i,
      /\bscore[sd]?\b/i,
      /\btotal\w*\b/i
    ]
  },
  {
    kind: 'import-export',
    signals: [/\bimport\w*\b/i, /\bexport\w*\b/i, /\bupload\w*\b/i, /\bcsv\b/i, /\bsync\w*\b/i]
  }
];
