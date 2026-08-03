/**
 * Real, working API endpoint — the backend is NOT the bug in this fixture.
 * Returns a fixed item list regardless of query so the check has something
 * genuine to fetch; the defect is entirely in the frontend's search handler,
 * which never applies the response to the DOM (see dist/index.html).
 */
export async function onRequest(): Promise<Response> {
  const items = ['Apple', 'Banana', 'Carrot', 'Date', 'Eggplant'];
  return new Response(JSON.stringify({ items }), {
    headers: { 'content-type': 'application/json' }
  });
}
