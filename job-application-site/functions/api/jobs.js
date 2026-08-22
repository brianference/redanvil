export async function onRequestGet(context) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
  };
  try {
    const { results } = await context.env.DB.prepare(
      `SELECT dedupe_key, company, title, url, match_pct, source, status, lane,
              submitted_at, posted, work_type, updated_at
       FROM jobs
       ORDER BY CASE lane WHEN 'submitted' THEN 0 WHEN 'ft' THEN 1 ELSE 2 END,
                COALESCE(match_pct, 0) DESC, company COLLATE NOCASE`
    ).all();
    return new Response(JSON.stringify({ jobs: results || [] }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ jobs: [], error: "query_failed" }), { status: 500, headers });
  }
}
