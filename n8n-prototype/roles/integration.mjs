#!/usr/bin/env node
/**
 * The `integration` role: prove the app's external data source answers TODAY.
 *
 * R33 has always said "prove the integration exists today" and no STEP required
 * one, so sushi-finder -- an app whose premise is worldwide discovery -- ran on
 * six seeded rows until the owner asked why. A rule without a step is not
 * enforced.
 *
 * Probes the deployed endpoint and records the real response. Refuses to write a
 * proof when the endpoint answers nothing, because a documented API is not a
 * working one.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a) => {
    const m = /^--([^=]+)=([\s\S]*)$/.exec(a);
    return m ? [[m[1], m[2]]] : [];
  })
);
if (!args.slug) {
  process.stderr.write('usage: integration.mjs --slug=X [--probe=/api/places?q=Tokyo]\n');
  process.exit(2);
}
const appDir = join(resolve(args.repoRoot ?? process.cwd()), args.slug);

let base = args.url ?? '';
const claims = join(appDir, '.redanvil', 'claims.json');
if (!base && existsSync(claims)) {
  try {
    base = JSON.parse(readFileSync(claims, 'utf8')).deployUrl ?? '';
  } catch {
    /* no claim yet */
  }
}
if (!base) {
  process.stderr.write('no deployed URL — an integration cannot be proven against an app that has not shipped\n');
  process.exit(1);
}

const probe = args.probe ?? '/api/places?q=Tokyo&limit=4';
const url = `${base}${probe}`;
let status = 0;
let body = {};
try {
  const res = await fetch(url);
  status = res.status;
  body = await res.json();
} catch (err) {
  process.stderr.write(`integration probe failed: ${String(err).slice(0, 120)}\n`);
  process.exit(1);
}

const count = body.count ?? (Array.isArray(body.places) ? body.places.length : 0);
const live = status === 200 && count > 0;

mkdirSync(join(appDir, 'evidence'), { recursive: true });
writeFileSync(
  join(appDir, 'evidence', 'integration-proof.json'),
  JSON.stringify(
    {
      provider: args.provider ?? 'google-places (Places API New, places:searchText)',
      endpoint: probe.split('?')[0],
      live,
      capturedAt: new Date().toISOString(),
      probeUrl: url,
      httpStatus: status,
      resultCount: count,
      sample: (body.places ?? []).slice(0, 3),
      keyHandling: 'provider key is a Cloudflare secret read server-side; never sent to the browser',
      note: 'A documented API is not a working one. This is a real response from the deployed Worker.'
    },
    null,
    2
  ) + '\n'
);

console.log(`integration: ${probe.split('?')[0]} -> ${status}, ${count} result(s), live=${live}`);
process.exit(live ? 0 : 1);
