/**
 * The one definition of "this file is something the gate wrote".
 *
 * Running the gate mutates the repository it is scoring: the coverage ratchet
 * records a new high-water mark, u-api-real-output saves the traffic it
 * captured, and the run's own result file lands in results/. Three separate
 * checks each treated those writes as evidence that the subject had moved --
 * freshness dropped every verdict, provenance marked every result dirty, and
 * verify_deployed refused to tie any result to a deploy. Each failure looked
 * like a different bug and each was the gate disqualifying its own output.
 *
 * It lives in one file because three copies of a predicate drift, and a
 * too-permissive copy would silently stop noticing real edits. The exclusion is
 * deliberately narrow: coverage-state.json, evidence/, and results/*.json only.
 * Not all of .redanvil/ (claims.json is a real input) and not all JSON.
 *
 * @param {string} file Repo-relative path.
 * @returns {boolean} True when the gate produced this file rather than a person editing it.
 */
export function isGateOutput(file) {
  const path = file.replace(/\\/g, '/');
  return (
    path.endsWith('/.redanvil/coverage-state.json') ||
    path.startsWith('.redanvil/coverage-state.json') ||
    /(^|\/)evidence\//.test(path) ||
    /^results\/[^/]+\.json$/.test(path)
  );
}
