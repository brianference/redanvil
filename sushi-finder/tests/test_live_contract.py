"""Invariant tests against the DEPLOYED sushi-finder.

The pytest lane exists in the process diagram and had never been written, so a
whole category of checking was absent while the step reported nothing wrong.

These assert invariants about live behaviour rather than re-testing what vitest
already covers: the shapes the frontend depends on, and the properties that must
hold for any query. Where a value cannot be trusted, the test says so and fails
rather than skipping quietly.
"""
from __future__ import annotations

import os
import urllib.request
import json

import pytest

BASE = os.environ.get("PLAYWRIGHT_BASE_URL", "https://sushi-finder.pages.dev").rstrip("/")


def get(path: str) -> tuple[int, dict]:
    """Fetch a JSON endpoint and return (status, body)."""
    # A real User-Agent. Cloudflare answers Python's default
    # "Python-urllib/3.x" with 403, which looked like an app failure and was
    # bot protection. A harness that is blocked reports defects it did not find.
    req = urllib.request.Request(
        f"{BASE}{path}",
        headers={
            "accept": "application/json",
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) redanvil-pytest",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return res.status, json.loads(res.read().decode())
    except urllib.error.HTTPError as err:  # noqa: PERF203 - status is the assertion
        return err.code, json.loads(err.read().decode() or "{}")


def test_health_is_json_not_spa_fallback() -> None:
    """Pages answers unmatched paths with index.html at 200, so a 200 proves nothing."""
    status, body = get("/api/health")
    assert status == 200
    assert body.get("status") == "ok"


def test_unknown_endpoint_is_a_real_404() -> None:
    """A JSON 404 is what distinguishes a real API from SPA fallback."""
    status, body = get("/api/definitely-not-real")
    assert status == 404
    assert "error" in body


def test_catalog_returns_the_seeded_rows() -> None:
    status, body = get("/api/sushis")
    assert status == 200
    items = body.get("items", [])
    assert len(items) >= 6, f"expected the seeded catalog, got {len(items)}"


def test_every_catalog_row_has_coordinates() -> None:
    """The Map view cannot plot a row without them."""
    _, body = get("/api/sushis")
    missing = [i["title"] for i in body.get("items", []) if i.get("lat") is None or i.get("lng") is None]
    assert not missing, f"rows without coordinates: {missing}"


def test_no_placeholder_rows_in_production() -> None:
    """A 'Sample' row shipped to pet-sitter's production and was served to users."""
    _, body = get("/api/sushis")
    bad = [i["title"] for i in body.get("items", []) if "sample" in i["title"].lower()]
    assert not bad, f"placeholder rows served to users: {bad}"


def test_places_search_is_live_and_geographic() -> None:
    """'sushi Tokyo' once resolved to a steakhouse in Walla Walla; 'in' fixed it."""
    status, body = get("/api/places?q=Tokyo&limit=5")
    assert status == 200
    places = body.get("places", [])
    assert places, "Places returned nothing for Tokyo"
    assert any("Tokyo" in p.get("address", "") or "Japan" in p.get("address", "") for p in places), (
        f"no Tokyo/Japan address in {[p.get('address') for p in places]}"
    )


def test_places_rejects_a_too_short_query() -> None:
    """Fail closed on bad input rather than returning an unbounded search."""
    status, _ = get("/api/places?q=a")
    assert status == 400


@pytest.mark.parametrize("zipcode", ["85331", "10001"])
def test_places_resolves_us_zip_codes(zipcode: str) -> None:
    """The owner searched 85331 and got nothing, because the UI never called this."""
    status, body = get(f"/api/places?q={zipcode}&limit=5")
    assert status == 200
    assert body.get("count", 0) > 0, f"no places for {zipcode}"


def test_places_never_leaks_the_api_key() -> None:
    """The key is a server-side secret; it must not appear in any response."""
    _, body = get("/api/places?q=Tokyo&limit=2")
    assert "AIza" not in json.dumps(body), "an API key appeared in the response body"


def test_every_place_has_usable_coordinates() -> None:
    _, body = get("/api/places?q=Tokyo&limit=8")
    for p in body.get("places", []):
        assert -90 <= p["lat"] <= 90, f"latitude out of range: {p}"
        assert -180 <= p["lng"] <= 180, f"longitude out of range: {p}"
