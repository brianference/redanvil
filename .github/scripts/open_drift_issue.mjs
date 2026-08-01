#!/usr/bin/env node
/**
 * Open (or reuse) a GitHub issue when a scheduled drift check fails.
 *
 * Uses the Actions GITHUB_TOKEN via the REST API. Does not open a duplicate
 * when an open issue with the same title already exists.
 *
 * Usage:
 *   node open_drift_issue.mjs --title "…" --body "…"
 *
 * Exit 0 when an issue was opened or already exists; 1 on API failure;
 * 2 on usage error.
 */
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const value = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : args[i + 1];
};
const title = value('title');
const body = value('body');
if (!title || !body) {
  console.error('usage: node open_drift_issue.mjs --title t --body b');
  process.exit(2);
}

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (!token) {
  console.error('open_drift_issue: GH_TOKEN / GITHUB_TOKEN is required');
  process.exit(1);
}

const repo =
  process.env.GITHUB_REPOSITORY ||
  (() => {
    try {
      const url = execFileSync('git', ['remote', 'get-url', 'origin'], {
        encoding: 'utf8'
      }).trim();
      const m = /github\.com[:/]([^/]+\/[^/.]+)/.exec(url);
      return m ? m[1].replace(/\.git$/, '') : null;
    } catch {
      return null;
    }
  })();

if (!repo) {
  console.error('open_drift_issue: cannot resolve owner/repo');
  process.exit(1);
}

const headers = {
  accept: 'application/vnd.github+json',
  authorization: `Bearer ${token}`,
  'x-github-api-version': '2022-11-28',
  'user-agent': 'redanvil-drift'
};

/**
 * @param {string} path
 * @param {RequestInit} [init]
 */
async function gh(path, init = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) }
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

const search = await gh(
  `/search/issues?q=${encodeURIComponent(`repo:${repo} is:issue is:open in:title "${title}"`)}`
);
if (search.status === 200 && search.json?.total_count > 0) {
  const existing = search.json.items[0];
  console.log(`open_drift_issue: already open #${existing.number} — ${existing.html_url}`);
  process.exit(0);
}

const created = await gh(`/repos/${repo}/issues`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    title,
    body: `${body}\n\n_Opened by the scheduled Drift re-gate workflow._`,
    labels: ['drift', 'finish-line']
  })
});

if (created.status === 201) {
  console.log(`open_drift_issue: opened #${created.json.number} — ${created.json.html_url}`);
  process.exit(0);
}

// Label may not exist — retry without labels.
if (created.status === 422) {
  const retry = await gh(`/repos/${repo}/issues`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title,
      body: `${body}\n\n_Opened by the scheduled Drift re-gate workflow._`
    })
  });
  if (retry.status === 201) {
    console.log(`open_drift_issue: opened #${retry.json.number} — ${retry.json.html_url}`);
    process.exit(0);
  }
  console.error('open_drift_issue: create failed', retry.status, retry.json);
  process.exit(1);
}

console.error('open_drift_issue: create failed', created.status, created.json);
process.exit(1);
