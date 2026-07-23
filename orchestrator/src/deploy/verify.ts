export interface DeployCheck {
  ok: boolean;
  reason?: string;
}

/** Extracts the built asset hash (e.g. `assets/index-<hash>.js`) from an HTML page, or null. */
export function extractAssetHash(html: string): string | null {
  const m = html.match(/assets\/index-([A-Za-z0-9_]+)\.js/);
  return m?.[1] ?? null;
}

/**
 * Confirms a deploy actually reached production: the asset hash served at
 * `prodUrl` must match the local build's hash. A deploy "success" message is not
 * proof; a matching hash is (mirrors the owner's Cloudflare rule).
 */
export async function verifyDeploy(
  prodUrl: string,
  localHtml: string,
  fetchImpl: typeof fetch = fetch
): Promise<DeployCheck> {
  const localHash = extractAssetHash(localHtml);
  if (!localHash) return { ok: false, reason: 'no asset hash in local build output' };

  let prodHtml: string;
  try {
    const res = await fetchImpl(prodUrl);
    prodHtml = await res.text();
  } catch (err) {
    return { ok: false, reason: `fetch failed: ${(err as Error).message}` };
  }

  const prodHash = extractAssetHash(prodHtml);
  if (prodHash !== localHash) {
    return {
      ok: false,
      reason: `asset hash mismatch: local ${localHash} vs prod ${prodHash ?? 'none'}`
    };
  }
  return { ok: true };
}
