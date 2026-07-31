import { chooseDesignDirection } from './sections/design';
import { PRD_THRESHOLD } from './types';

/**
 * The machine-readable claims a generated app makes about itself.
 *
 * Everything in here was ALREADY computed when the PRD was generated, rendered
 * into prose, and thrown away.
 *
 * `chooseDesignDirection` returns `{archetype, visual, rejected}` — the exact
 * structure a check would need to ask "did you build the shell you were told to
 * build?" — and `buildDesignDirection` immediately flattens it to markdown. §7.3a
 * calls itself **binding** and lists shells the app must not fall back to, and
 * nothing has ever been able to read either. `buildFrontmatter` emits appType,
 * hasAuth and entities into a YAML fence that no orchestrator code parses. The
 * feature list, with an acceptance criterion per feature, exists in memory and
 * survives only as bullet points.
 *
 * So the gate could not check the app against what it promised, because the
 * promise was only ever kept as prose. `apiJudge` works around this by handing
 * file paths to a model and asking it to read them — which is the right shape
 * for a judgment but the wrong shape for a deterministic check.
 *
 * This is the same inversion the feature audit already applies to controls: the
 * inventory comes from the app's own declaration, so an unimplemented claim is
 * unproven-by-default rather than silently absent.
 */

/** One thing the product says it does, and how you would know it did. */
export interface FeatureClaim {
  /** Stable id from the feature catalogue, e.g. `F2`. */
  id: string;
  /** Human name, matched against test titles. */
  name: string;
  /** What it does, one line. */
  behavior: string;
  /** GIVEN/WHEN/THEN lines, already written when the PRD was generated. */
  acceptance: string[];
  /** Whether it is in the minimum viable scope. */
  mvp: boolean;
}

/** What a cold-start check should drive, derived from the product's own claims. */
export interface ColdVisitorProbe {
  /** Accessible name of the control that starts the primary flow. */
  control: string;
  /** Selector-to-value map filled before activating the control. */
  fill: Record<string, string>;
  /** What a real answer renders. */
  expectSelector: string;
  /** Fewest results that count as a real answer. */
  minCount: number;
}

/** Everything an app claims, in a form a check can read. */
export interface AppClaims {
  kind: 'claims';
  slug: string;
  title: string;
  appType: string;
  hasAuth: boolean;
  entities: string[];
  threshold: number;
  /** The shell this app was told to build, and the ones it must not fall back to. */
  design: {
    archetype: string;
    structure: string;
    visual: string;
    rejected: string[];
  };
  features: FeatureClaim[];
  /**
   * Optional, because only the author knows what a realistic query looks like.
   * Absent means the cold-start check cannot run and must say so rather than
   * report a pass — see cold_visitor.mjs, which exits 2 without one.
   */
  coldVisitorProbe?: ColdVisitorProbe;
}

/**
 * Build the claims object for an app, from the same inputs the PRD renders.
 *
 * The seed must match the one `buildDesignDirection` uses, or the claims would
 * name a different archetype than the spec the builder read — a check that
 * disagrees with the document it is enforcing is worse than no check.
 *
 * @param opts - The generated app's identity, wizard answers and features.
 * @returns Claims ready to serialise into `.redanvil/claims.json`.
 */
export function buildClaims(opts: {
  slug: string;
  title: string;
  prompt: string;
  appType: string;
  hasAuth: boolean;
  entities: string[];
  features: readonly {
    id: string;
    name: string;
    behavior: string;
    acceptance: readonly string[];
    mvp: boolean;
  }[];
  coldVisitorProbe?: ColdVisitorProbe;
}): AppClaims {
  // Same seed shape as generate.ts uses for §7.3a.
  const direction = chooseDesignDirection(`${opts.prompt}|${opts.appType}|${opts.entities}`);
  return {
    kind: 'claims',
    slug: opts.slug,
    title: opts.title,
    appType: opts.appType,
    hasAuth: opts.hasAuth,
    entities: [...opts.entities],
    threshold: PRD_THRESHOLD,
    design: {
      archetype: direction.archetype.name,
      structure: direction.archetype.structure,
      visual: direction.visual.name,
      rejected: [...direction.rejected]
    },
    features: opts.features.map((f) => ({
      id: f.id,
      name: f.name,
      behavior: f.behavior,
      acceptance: [...f.acceptance],
      mvp: f.mvp
    })),
    ...(opts.coldVisitorProbe === undefined ? {} : { coldVisitorProbe: opts.coldVisitorProbe })
  };
}

/**
 * Serialise claims for `.redanvil/claims.json`.
 *
 * @param claims - Built claims.
 * @returns Pretty JSON with a trailing newline.
 */
export function claimsJson(claims: AppClaims): string {
  return JSON.stringify(claims, null, 2) + '\n';
}
