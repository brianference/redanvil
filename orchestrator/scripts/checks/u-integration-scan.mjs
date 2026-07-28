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
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Directories that hold this app's own code. */
const CODE_DIRS = ['src', 'functions', 'scripts'];

/** Every non-test source file in the app, for the applicability probe. */
function sourceFiles(appDir) {
  const out = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)) {
        out.push(full);
      }
    }
  };
  for (const dir of CODE_DIRS) walk(join(appDir, dir));
  return out;
}

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

  // Applicability is decided by the code, not by the app's age. An app that
  // calls nothing external has no integration to have scanned for; the moment
  // it fetches a third-party origin, the scan is owed.
  //
  // Deliberately NOT "skip if this looks like a fresh scaffold" — that is the
  // n/a-hides-coverage trap, where a rule quietly never applies to anything.
  // The first version of this probe matched `fetch('https://…')` inline and
  // reported n/a for the app that calls Travelpayouts — whose origin is a named
  // constant and whose call goes through an injected `fetchImpl`. It looked
  // right and failed in the flattering direction, silently exempting the exact
  // app the rule exists for. Two independent signals now, both required:
  // an external origin literal, and something that performs a request.
  const callers = sourceFiles(appDir).filter((file) => {
    const src = readFileSync(file, 'utf8');
    const origins = [...src.matchAll(/["'`]https?:\/\/([^/"'`\s${}]+)/g)].map((m) => m[1] ?? '');
    const external = origins.some(
      (host) =>
        // XML/JSON-LD namespaces are declarations, not calls.
        !/(^|\.)(w3\.org|schema\.org|sitemaps\.org)$/.test(host) &&
        !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)
    );
    return external && /\bfetch\b/.test(src);
  });

  if (callers.length === 0 && !existsSync(path)) {
    io.notApplicable('this app calls no external service, so there is no integration to record');
  }

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

  // R33.1 — the tools already attached to the session outrank anything on the
  // open web, and they were skipped entirely until a user asked. QuickFlight's
  // real seed fares came from the Expedia MCP connector that was available the
  // whole time.
  if (!/##\s*Connectors considered/i.test(doc)) {
    io.fail(
      'INTEGRATIONS.md has no "## Connectors considered" section — enumerate the MCP ' +
        'connectors available in the session BEFORE searching the web (R33). An ' +
        'already-authenticated connector beats every third-party key. Record them even ' +
        'when they lose.'
    );
  }

  // R33.2/33.4 — every candidate needs a primary source and the date it was
  // checked. Amadeus Self-Service was decommissioned 2026-07-17 while still
  // being the top result in "best free flight APIs for 2026" guides.
  // Parse tables structurally: a header is the line above a `|---|` separator.
  // Only tables carrying a `checked` column are treated as EVIDENCE tables. A
  // repo listing's `last push` column is a fact about the repo — an old date
  // there is the finding, not stale evidence — so ageing it would be wrong.
  const lines = doc.split('\n');
  const isSeparator = (line) => /^\s*\|[\s:|-]*\|\s*$/.test(line) && line.includes('-');
  const cells = (line) =>
    line
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((c) => c.trim());

  /** @type {{cell:string, row:string}[]} */
  const checkedCells = [];
  let evidenceTables = 0;
  for (let i = 0; i < lines.length; i += 1) {
    if (!isSeparator(lines[i + 1] ?? '')) continue;
    const header = cells(lines[i] ?? '');
    const col = header.findIndex((h) => /^(checked|verified)$/i.test(h));
    if (col === -1) continue;
    evidenceTables += 1;
    for (let r = i + 2; r < lines.length && /^\s*\|/.test(lines[r] ?? ''); r += 1) {
      const row = lines[r] ?? '';
      if (isSeparator(row)) continue;
      checkedCells.push({ cell: cells(row)[col] ?? '', row });
    }
  }

  if (evidenceTables === 0) {
    io.fail(
      'no evidence table — at least one table must carry a `checked` column recording ' +
        'WHEN each candidate was verified against a primary source, or the scan cannot be ' +
        'aged out and becomes memory (R33)'
    );
  }

  const unsourced = checkedCells.filter(({ row }) => !/https?:\/\/\S+/.test(row));
  if (unsourced.length > 0) {
    io.fail(
      `${unsourced.length} candidate row(s) cite no source URL — an unlinked claim is a ` +
        `memory, and memories go stale silently (R33):\n  ${unsourced
          .map(({ row }) => row.trim().slice(0, 100))
          .slice(0, 5)
          .join('\n  ')}`
    );
  }

  const undated = checkedCells.filter(({ cell }) => !/^\d{4}-\d{2}-\d{2}$/.test(cell));
  if (undated.length > 0) {
    io.fail(
      `${undated.length} row(s) have no yyyy-mm-dd in the \`checked\` column (R33):\n  ${undated
        .map(({ row }) => row.trim().slice(0, 100))
        .slice(0, 5)
        .join('\n  ')}`
    );
  }

  // R33 enforcement — stale evidence fails closed. Verified-a-year-ago is memory.
  const MAX_AGE_DAYS = 90;
  const today = Date.now();
  const stale = checkedCells
    .map(({ cell, row }) => ({
      row,
      ageDays: Math.floor((today - new Date(`${cell}T00:00:00Z`).getTime()) / 86_400_000)
    }))
    .filter(({ ageDays }) => Number.isFinite(ageDays) && ageDays > MAX_AGE_DAYS);

  if (stale.length > 0) {
    io.fail(
      `${stale.length} candidate(s) verified more than ${MAX_AGE_DAYS} days ago — re-check ` +
        `against a primary source before relying on them (R33):\n  ${stale
          .map(({ row, ageDays }) => `${row.trim().slice(0, 80)} (${ageDays}d old)`)
          .slice(0, 5)
          .join('\n  ')}`
    );
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
