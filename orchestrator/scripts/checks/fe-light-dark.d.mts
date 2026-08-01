/**
 * Types for pure helpers exported from `fe-light-dark.mjs`.
 * Must match the real JS signatures — tests import these under strict.
 */

export declare const SAME_PAINT_CHANNEL_DELTA: number;
export declare const SAME_PAINT_LUM_DELTA: number;

/** RGB triple with optional alpha (browser-sampled paint). */
export interface Rgb {
  r: number;
  g: number;
  b: number;
  a?: number;
}

/** One landmark region sample from the page. */
export interface LandmarkSample extends Rgb {
  name: string;
  css: string;
}

export declare function relativeLuminance(r: number, g: number, b: number): number;

export declare function effectivelySamePaint(a: Rgb, b: Rgb): boolean;

export declare function paintDiffFailures(
  light: LandmarkSample[],
  dark: LandmarkSample[]
): string[];

export type LightDarkIo = {
  pass: () => never;
  fail: (m?: string) => never;
  notApplicable: (w?: string) => never;
  infra: (m?: string) => never;
};

export declare function runLightDark(
  appDir: string,
  io: LightDarkIo,
  opts?: { url?: string; fixture?: string }
): Promise<void>;
