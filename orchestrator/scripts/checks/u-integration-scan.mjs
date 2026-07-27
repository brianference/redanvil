#!/usr/bin/env node
/**
 * u-integration-scan — the app recorded what already existed before building it.
 *
 * Usage: node u-integration-scan.mjs <appDir>
 * Exit 0 = pass, 1 = fail, 3 = not applicable.
 *
 * Why (R29): "reuse before rebuild" as prose produces nothing checkable, and a
 * search nobody recorded is a search nobody can review. `INTEGRATIONS.md` is the
 * artifact — candidates with licence, language and last-push, plus a stated
 * decision and its reason.
 *
 * What this caught when it was written: three flight APIs advertise generous
 * free tiers and none of them return fares, and every zero-cost fare library is
 * Python while the app runs on Cloudflare Workers. Both facts changed the
 * architecture, and neither was knowable without looking.
 *
 * This checks the file exists and was actually completed — a scan whose decision
 * section is still the template stub did not finish.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Phrases the generator leaves behind for a human to replace. */
const UNFILLED = [/\*\*Build \/ integrate \/ hybrid:\*\*\s*…/, /\*\*Why:\*\*\s*…/, /Fill this in/i];

/**
 * Run the check.
 *
 * @param {string} appDir App directory.
 * @param {{pass:()=>never, fail:(m?:string)=>never, notApplicable:(w?:string)=>never}} io
 */
export function runIntegrationScan(appDir, io) {
  const path = join(appDir, 'INTEGRATIONS.md');
  if (!existsSync(path)) {
    io.fail(
      'no INTEGRATIONS.md — run integration_scan.mjs before building a capability, and ' +
        'record what already exists, what it costs, its licence and whether it runs in ' +
        'this runtime (R29)'
    );
  }

  const doc = readFileSync(path, 'utf8');

  if (!/\|\s*repo\s*\|/i.test(doc)) {
    io.fail('INTEGRATIONS.md has no candidate table — the scan did not run, or found nothing');
  }

  const stub = UNFILLED.find((re) => re.test(doc));
  if (stub) {
    io.fail(
      'INTEGRATIONS.md still contains the template stub — the table is evidence, not a ' +
        'decision. State the build/integrate call and why.'
    );
  }

  if (!/##\s*Decision/i.test(doc)) {
    io.fail('INTEGRATIONS.md has no Decision section');
  }

  // A decision with no reasoning is a decision nobody can revisit.
  const decision = doc.slice(doc.search(/##\s*Decision/i));
  if (decision.trim().length < 200) {
    io.fail('the Decision section is too thin to explain the choice or let anyone revisit it');
  }

  io.pass();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: node u-integration-scan.mjs <appDir>');
    process.exit(2);
  }
  runIntegrationScan(dir, {
    pass: () => process.exit(0),
    fail: (m) => {
      if (m) console.error(m);
      process.exit(1);
    },
    notApplicable: (w) => {
      if (w) console.error(`n/a: ${w}`);
      process.exit(3);
    }
  });
}
