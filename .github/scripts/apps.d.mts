/**
 * Types for the gated app list in `apps.mjs`.
 */

/** One legal/about page a stranger must reach from the footer. */
export interface StrangerRequiredPage {
  /** Route path (e.g. `/about`). */
  path: string;
  /** Accessible name of the footer link. */
  linkName: string;
  /** Accessible name of the page heading that must render. */
  headingText: string;
}

/** Per-app stranger-driver expectations (observation layer only). */
export interface StrangerExpectations {
  /** What the app is for -- fed to StrangerView.appDescription. */
  purposeSentence: string;
  /**
   * Text a stranger types into the primary control for THIS app:
   * - coreFlow `search`: crop name, run slug, filter substring
   * - coreFlow `wizard`: plain-language forge prompt for the composer
   * Never another app's query.
   */
  searchQuery: string;
  /** Footer-linked pages that must load with real substance. */
  requiredPages: readonly StrangerRequiredPage[];
}

/** Primary product flow product-judgement harnesses exercise. */
export type CoreFlow = 'search' | 'wizard';

export interface GatedApp {
  slug: string;
  dir: string;
  url: string;
  designRoutes: string;
  widthRoutes: string | null;
  e2e: boolean;
  wizard: boolean;
  /**
   * What qa_visual and user_refuse exercise as the core flow.
   * `search` = today's filter/search path; `wizard` = chat → Forge PRD.
   */
  coreFlow: CoreFlow;
  na: string;
  /** Required pages + purpose for user-refuse; never shared across apps. */
  stranger: StrangerExpectations;
}

export declare const APPS: readonly GatedApp[];
export declare function appBySlug(slug: string): GatedApp | undefined;
export declare function coreFlowForSlug(slug: string): CoreFlow;
