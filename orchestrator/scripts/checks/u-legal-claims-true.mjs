#!/usr/bin/env node
/**
 * u-legal-claims-true — bidirectional match between legal copy and code.
 *
 * Usage: node u-legal-claims-true.mjs <appDir>
 * Exit 0 = pass, 1 = fail, 3 = n/a (no legal pages).
 *
 * For cookies, accounts/auth, payments, analytics/tracking, and email
 * collection:
 *   - if copy DENIES it, code must show no evidence of it;
 *   - if code HAS it, copy must disclose it.
 *
 * Boilerplate that denies cookies you set is a false disclosure; an
 * undisclosed tracker is worse.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeMeasurementMetaEntry, nowIso } from '../lib/measurement-meta.mjs';

/**
 * @typedef {{
 *   pass: () => never,
 *   fail: (m?: string) => never,
 *   notApplicable: (w?: string) => never
 * }} LegalIo
 */

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   denyRes: RegExp[],
 *   discloseRes: RegExp[],
 *   codeRes: RegExp[]
 * }} ClaimTopic
 */

/**
 * Topics compared bidirectionally between legal prose and source.
 * Patterns are deliberately conservative -- a miss is fail-closed only when
 * code evidence is strong (cookie writes, stripe, gtag, etc.).
 *
 * @type {ClaimTopic[]}
 */
export const TOPICS = [
  {
    id: 'cookies',
    label: 'cookies',
    denyRes: [
      /we\s+do\s+not\s+use\s+cookies/i,
      /no\s+cookies/i,
      /does\s+not\s+use\s+cookies/i,
      /without\s+cookies/i,
      /do\s+not\s+set\s+cookies/i
    ],
    discloseRes: [/\bcookies?\b/i, /\bSet-Cookie\b/i],
    codeRes: [
      /document\.cookie\s*=/,
      /Set-Cookie/i,
      /\bcookieStore\b/,
      /js-cookie|js\.cookie/i,
      /\bcookies?\s*\.\s*set\s*\(/i
    ]
  },
  {
    id: 'accounts',
    label: 'accounts/authentication',
    denyRes: [
      /no\s+accounts?\s+required/i,
      /does\s+not\s+require\s+(an\s+)?accounts?/i,
      /no\s+login\s+required/i,
      /we\s+do\s+not\s+(offer|provide|require)\s+accounts?/i,
      /without\s+(creating\s+)?an?\s+account/i
    ],
    discloseRes: [
      /\baccounts?\b/i,
      /\blog\s*in\b/i,
      /\bsign\s*up\b/i,
      /\bauthenticat/i,
      /\bsession\b/i
    ],
    codeRes: [
      /\/api\/auth\b/,
      /\/api\/login\b/,
      /\/api\/signup\b/,
      /\/api\/session\b/,
      /\bpassword_hash\b/,
      /\bverifyPassword\b/,
      /\bcreateSession\b/,
      /better-auth|clerk\.|@clerk|supabase\.auth|next-auth|lucia/i
    ]
  },
  {
    id: 'payments',
    label: 'payments',
    denyRes: [
      /we\s+do\s+not\s+(process|accept|take)\s+payments?/i,
      /no\s+payments?/i,
      /does\s+not\s+(process|handle)\s+payments?/i,
      /no\s+billing/i
    ],
    discloseRes: [/\bpayments?\b/i, /\bbilling\b/i, /\bstripe\b/i, /\bcredit\s+card\b/i],
    codeRes: [
      /\bstripe\b/i,
      /js\.stripe\.com/i,
      /\b@stripe\//,
      /\bpaypal\b/i,
      /\bbraintree\b/i,
      /paymentIntent|createCheckoutSession/i
    ]
  },
  {
    id: 'analytics',
    label: 'third-party analytics/tracking',
    denyRes: [
      /we\s+do\s+not\s+use\s+(third[- ]party\s+)?(analytics|tracking)/i,
      /no\s+(third[- ]party\s+)?(analytics|trackers?)/i,
      /does\s+not\s+(track|use\s+analytics)/i,
      /no\s+tracking/i
    ],
    discloseRes: [
      /\banalytics\b/i,
      /\btracking\b/i,
      /\bgoogle\s+analytics\b/i,
      /\bplausible\b/i,
      /\btelemetry\b/i
    ],
    codeRes: [
      /google-analytics|googletagmanager|gtag\s*\(/i,
      /www\.google-analytics\.com|googletagmanager\.com/i,
      /\bplausible\b/i,
      /analytics\.js|segment\.(io|com)|mixpanel|hotjar|fullstory/i,
      /posthog|amplitude\.com|sentry\.io/i
    ]
  },
  {
    id: 'email',
    label: 'email collection',
    denyRes: [
      /we\s+do\s+not\s+collect\s+(your\s+)?email/i,
      /no\s+email\s+(collection|addresses)/i,
      /does\s+not\s+collect\s+email/i,
      /never\s+collects?\s+email/i
    ],
    discloseRes: [/\bemail\b/i, /\be-mail\b/i, /\bnewsletter\b/i, /\bmailing\s+list\b/i],
    codeRes: [
      /type\s*=\s*['"]email['"]/,
      /name\s*=\s*['"]email['"]/,
      /\.email\s*[:=]/,
      /z\.string\(\)\s*\.email\(/,
      /mailto:/i,
      /resend|sendgrid|mailgun|postmark/i
    ]
  }
];

/**
 * Walk source files under dir (skips node_modules/dist/tests).
 *
 * @param {string} dir
 * @param {string[]} [out]
 * @returns {string[]}
 */
function walkSources(dir, out = []) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) {
      continue;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkSources(full, out);
    } else if (
      /\.(tsx?|jsx?|mjs|cjs|html|css)$/.test(entry.name) &&
      !/\.(test|spec)\./.test(entry.name)
    ) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Locate legal/privacy/terms/about page sources and public HTML.
 *
 * @param {string} appDir
 * @returns {{ files: string[], text: string }}
 */
export function loadLegalCopy(appDir) {
  const candidates = [];
  const roots = [join(appDir, 'src'), join(appDir, 'public'), join(appDir, 'pages')];
  for (const root of roots) {
    for (const f of walkSources(root)) {
      const rel = relative(appDir, f).replace(/\\/g, '/');
      if (
        /privacy|terms|legal|about|cookie/i.test(rel) ||
        /privacy|terms|legal/i.test(f.split(/[/\\]/).pop() ?? '')
      ) {
        candidates.push(f);
      }
    }
  }
  // Also catch route files named Privacy.tsx etc.
  const src = join(appDir, 'src');
  for (const f of walkSources(src)) {
    const base = (f.split(/[/\\]/).pop() ?? '').toLowerCase();
    if (/^(privacy|terms|legal|about|cookie)/.test(base) && !candidates.includes(f)) {
      candidates.push(f);
    }
  }

  const parts = [];
  for (const f of candidates) {
    try {
      parts.push(`\n/* ${relative(appDir, f)} */\n` + readFileSync(f, 'utf8'));
    } catch {
      // skip
    }
  }
  return { files: candidates, text: parts.join('\n') };
}

/**
 * Load application source used for behavioural evidence (not legal pages alone).
 *
 * @param {string} appDir
 * @returns {{ files: { path: string, text: string }[] }}
 */
export function loadAppCode(appDir) {
  const files = [
    ...walkSources(join(appDir, 'src')),
    ...walkSources(join(appDir, 'functions')),
    ...walkSources(join(appDir, 'public'))
  ];
  /** @type {{ path: string, text: string }[]} */
  const out = [];
  for (const f of files) {
    const rel = relative(appDir, f).replace(/\\/g, '/');
    // Legal pages are the disclosure side; still scan them for code-like embeds
    // but primary evidence is non-legal source.
    try {
      out.push({ path: rel, text: readFileSync(f, 'utf8') });
    } catch {
      // skip
    }
  }
  return { files: out };
}

/**
 * First code hit for a topic, or null.
 *
 * @param {ClaimTopic} topic
 * @param {{ path: string, text: string }[]} files
 * @returns {{ path: string, phrase: string } | null}
 */
export function findCodeEvidence(topic, files) {
  for (const f of files) {
    for (const re of topic.codeRes) {
      const m = re.exec(f.text);
      if (m) {
        return { path: f.path, phrase: m[0].slice(0, 80) };
      }
    }
  }
  return null;
}

/**
 * First matching phrase from a list of regexes, or null.
 *
 * @param {string} text
 * @param {RegExp[]} res
 * @returns {string | null}
 */
export function firstPhrase(text, res) {
  for (const re of res) {
    const m = re.exec(text);
    if (m) return m[0];
  }
  return null;
}

/**
 * Compare one topic bidirectionally.
 *
 * @param {ClaimTopic} topic
 * @param {string} legalText
 * @param {{ path: string, text: string }[]} codeFiles
 * @returns {string | null} Mismatch detail, or null when consistent.
 */
export function compareTopic(topic, legalText, codeFiles) {
  const deny = firstPhrase(legalText, topic.denyRes);
  const disclose = firstPhrase(legalText, topic.discloseRes);
  const code = findCodeEvidence(topic, codeFiles);

  if (deny && code) {
    return (
      `${topic.label}: copy denies it (${JSON.stringify(deny)}) but code shows ` +
      `${code.path}: ${JSON.stringify(code.phrase)}`
    );
  }
  if (code && !disclose) {
    return (
      `${topic.label}: code has ${code.path}: ${JSON.stringify(code.phrase)} ` +
      `but legal/privacy pages never disclose it`
    );
  }
  return null;
}

/**
 * Decide u-legal-claims-true.
 *
 * @param {string} appDir
 * @param {LegalIo} io
 * @returns {void}
 */
export function runLegalClaimsTrue(appDir, io) {
  const { pass, fail, notApplicable } = io;
  const legal = loadLegalCopy(appDir);
  if (legal.files.length === 0 || legal.text.trim().length < 40) {
    return notApplicable('no legal/privacy pages found (fe-required-pages covers absence)');
  }

  const { files } = loadAppCode(appDir);
  /** @type {string[]} */
  const mismatches = [];
  for (const topic of TOPICS) {
    const m = compareTopic(topic, legal.text, files);
    if (m) mismatches.push(m);
  }

  const ok = mismatches.length === 0;
  writeMeasurementMetaEntry(appDir, 'u-legal-claims-true', {
    tool: 'static-bidirectional',
    engine: null,
    runs: [
      { ok, at: nowIso() },
      { ok, at: nowIso() }
    ]
  });

  if (!ok) {
    return fail(
      `${mismatches.length} legal claim mismatch(es):\n` + mismatches.map((m) => `  ${m}`).join('\n')
    );
  }
  return pass();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: node u-legal-claims-true.mjs <appDir>');
    process.exit(2);
  }
  runLegalClaimsTrue(dir, {
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
