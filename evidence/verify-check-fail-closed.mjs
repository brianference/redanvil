/**
 * Prove fe-resource-links / fe-breadcrumbs fail when no real detail id exists.
 * A check that cannot fail is not a check.
 */
import {
  materialiseRoute,
  resolveRealDetailId,
  firstRealIdFromJson
} from '../orchestrator/scripts/checks/fe-resource-links.mjs';
import {
  materialiseRoute as bcMaterialise,
  resolveRealDetailId as bcResolve
} from '../orchestrator/scripts/checks/fe-breadcrumbs.mjs';

let failed = 0;

/**
 * @param {string} name
 * @param {boolean} ok
 * @param {string} detail
 */
function assert(name, ok, detail) {
  if (ok) console.log(`PASS ${name}: ${detail}`);
  else {
    console.error(`FAIL ${name}: ${detail}`);
    failed += 1;
  }
}

assert(
  'json-empty',
  firstRealIdFromJson({ sitters: [] }) === null,
  'empty array yields null'
);
assert(
  'json-real',
  firstRealIdFromJson({ sitters: [{ id: 'sit-yorkville-08' }] }) === 'sit-yorkville-08',
  'real id returned'
);
assert(
  'json-skip-sample',
  firstRealIdFromJson({ sitters: [{ id: 'sample' }, { id: 'sit-real' }] }) === 'sit-real',
  'prefers non-sample'
);

const emptyFetch = async () => ({
  ok: true,
  status: 200,
  async json() {
    return { sitters: [], count: 0 };
  },
  async text() {
    return '<html><body>no links</body></html>';
  }
});

const none = await resolveRealDetailId('https://empty.test', '/sitters/:id', {
  fetchImpl: emptyFetch
});
assert('resolve-empty', none === null, String(none));

let threw = false;
try {
  materialiseRoute('/sitters/:id', none);
} catch (e) {
  threw = e instanceof Error && e.message === 'no real detail id available';
}
assert('materialise-throws', threw, 'throws no real detail id available');

const noneBc = await bcResolve('https://empty.test', '/sitters/:id', {
  fetchImpl: emptyFetch
});
assert('bc-resolve-empty', noneBc === null, String(noneBc));
let threwBc = false;
try {
  bcMaterialise('/sitters/:id', null);
} catch (e) {
  threwBc = e instanceof Error && e.message === 'no real detail id available';
}
assert('bc-materialise-throws', threwBc, 'throws no real detail id available');

// Live: real id from production
const live = await resolveRealDetailId(
  'https://pet-sitter-vz1.pages.dev',
  '/sitters/:id'
);
assert(
  'live-real-id',
  typeof live === 'string' && live.length > 0 && live !== 'sample',
  String(live)
);
assert(
  'live-path',
  materialiseRoute('/sitters/:id', live) === `/sitters/${live}`,
  materialiseRoute('/sitters/:id', live)
);

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nAll fail-closed assertions passed');
