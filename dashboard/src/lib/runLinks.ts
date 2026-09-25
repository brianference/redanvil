/**
 * External sources for one run: the gate's own record of it and the commit it
 * scored. Both live in the public RedAnvil repository, which is also where the
 * feed itself is read from.
 */

import { GITHUB_URL as REPO_URL } from '../components/shell/constants';

/**
 * The result file the gate wrote for this app (`results/<slug>.json`), which
 * `results/all.json` is derived from.
 *
 * @param slug - Run slug.
 * @returns Absolute GitHub URL of the result file on the default branch.
 */
export function gateResultUrl(slug: string): string {
  return `${REPO_URL}/blob/master/results/${encodeURIComponent(slug)}.json`;
}

/**
 * The commit the gate scored, or null when the feed row did not record one.
 *
 * @param commit - Full commit SHA from the row's provenance.
 * @returns Absolute GitHub commit URL, or null.
 */
export function gatedCommitUrl(commit: string | null): string | null {
  return commit === null ? null : `${REPO_URL}/commit/${commit}`;
}
