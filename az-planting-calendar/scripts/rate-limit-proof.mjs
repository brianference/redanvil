/**
 * Burn the assistant minute quota for one CF-Connecting-IP and print
 * status + Retry-After. Then show a different IP still under the limit,
 * and that a missing-IP caller is bucketed (fail closed).
 */
const base = process.env.BASE_URL ?? 'http://127.0.0.1:8788';
const ip = '203.0.113.77';

/**
 * POST /api/assistant once.
 *
 * @param {string | null} connectingIp - CF-Connecting-IP or null to omit.
 * @param {string} message - Body message.
 */
async function postAssistant(connectingIp, message) {
  /** @type {Record<string, string>} */
  const headers = { 'content-type': 'application/json' };
  if (connectingIp !== null) {
    headers['CF-Connecting-IP'] = connectingIp;
  }
  const res = await fetch(`${base}/api/assistant`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message })
  });
  const retryAfter = res.headers.get('retry-after');
  let bodyText = await res.text();
  if (bodyText.length > 160) bodyText = bodyText.slice(0, 160) + '…';
  return { status: res.status, retryAfter, bodyText };
}

console.log(`=== Rate limit loop (IP ${ip}) against ${base} ===`);
let first429 = null;
for (let i = 1; i <= 12; i += 1) {
  const r = await postAssistant(ip, 'What can I plant in early August?');
  console.log(
    `#${i} status=${r.status} Retry-After=${r.retryAfter ?? '-'} body=${r.bodyText}`
  );
  if (r.status === 429 && first429 === null) {
    first429 = r;
  }
}

console.log('=== Different IP still under limit (must not be 429 from shared open bypass) ===');
const other = await postAssistant('198.51.100.99', 'seed lettuce');
console.log(
  `other status=${other.status} Retry-After=${other.retryAfter ?? '-'} body=${other.bodyText}`
);

console.log('=== Missing CF-Connecting-IP (shared fail-closed bucket) ===');
const missing = await postAssistant(null, 'tomatoes');
console.log(
  `missing-ip status=${missing.status} Retry-After=${missing.retryAfter ?? '-'} body=${missing.bodyText}`
);

if (!first429) {
  console.error('FAIL: never saw 429 within 12 requests');
  process.exit(1);
}
if (other.status === 429) {
  console.error('FAIL: unrelated IP was rate limited (buckets not isolated)');
  process.exit(1);
}
console.log('OK: saw 429 with Retry-After and isolated other IP');
