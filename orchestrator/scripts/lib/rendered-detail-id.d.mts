export declare const RENDER_WAIT_MS: number;
export declare function detailLinkSelector(origin: string, collection: string): string;
export declare function firstRealIdFromRenderedPages(
  browser: { newPage: (o?: object) => Promise<unknown> },
  origin: string,
  collection: string,
  extractId: (html: string, collection: string) => string | null,
  opts?: { waitMs?: number }
): Promise<string | null>;
