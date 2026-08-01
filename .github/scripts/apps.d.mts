/**
 * Types for the gated app list in `apps.mjs`.
 */

export interface GatedApp {
  slug: string;
  dir: string;
  url: string;
  designRoutes: string;
  widthRoutes: string | null;
  e2e: boolean;
  wizard: boolean;
  na: string;
}

export declare const APPS: readonly GatedApp[];
export declare function appBySlug(slug: string): GatedApp | undefined;
