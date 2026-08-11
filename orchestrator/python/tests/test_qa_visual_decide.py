"""
Property tests for the QA-visual pure decision (SPEC §3).

Calls the same Node decision entry the gate uses so vitest and pytest share
one code path. Hypothesis explores viewport/y combinations a table cannot list.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

try:
    from hypothesis import given, settings, HealthCheck
    from hypothesis import strategies as st
except ImportError:  # pragma: no cover
    pytest.skip("hypothesis not installed", allow_module_level=True)

ORCH = Path(__file__).resolve().parents[1].parent
DECIDE = ORCH / "scripts" / "team" / "decide-qa-visual.mjs"


def decide(observations: list[dict]) -> dict:
    """Invoke the Node decision CLI and return the parsed verdict object."""
    payload = json.dumps({"observations": observations})
    proc = subprocess.run(
        [sys.executable.replace("python", "node") if False else "node", str(DECIDE), payload],
        capture_output=True,
        text=True,
        check=False,
    )
    # node is on PATH; fall back to process lookup
    if proc.returncode not in (0, 1) and "not found" in (proc.stderr or "").lower():
        proc = subprocess.run(
            ["node", str(DECIDE), payload],
            capture_output=True,
            text=True,
            check=False,
        )
    assert proc.stdout.strip(), f"empty stdout: stderr={proc.stderr!r} code={proc.returncode}"
    return json.loads(proc.stdout.strip())


def base_obs(**overrides: object) -> dict:
    """A baseline observation that passes when nothing is overridden badly."""
    m = {
        "viewportWidth": 1280,
        "viewportHeight": 900,
        "primaryResultY": 80,
        "primaryResultHeight": 40,
        # 72, not 48: decide-qa-visual.mjs raised the brand-mark floor to 72 at
        # viewportWidth >= 1280 and this baseline was never updated, so the
        # "observation that passes when nothing is overridden badly" had in fact
        # been failing on every run. A baseline that does not pass cannot show
        # what any override actually changed.
        "brandMarkHeight": 72,
        "headerHeight": 64,
        "heroHeight": 200,
        "truncatedElementCount": 0,
        "primaryActionAboveFold": True,
        "route": "/",
        "theme": "light",
    }
    m.update(overrides)
    return m


@given(
    viewport_height=st.integers(min_value=100, max_value=2000),
    y_over=st.integers(min_value=0, max_value=5000),
)
@settings(max_examples=80, suppress_health_check=[HealthCheck.too_slow])
def test_result_below_fold_always_fails(viewport_height: int, y_over: int) -> None:
    """A result whose y exceeds the viewport height always fails."""
    y = viewport_height + y_over
    result = decide([base_obs(viewportHeight=viewport_height, primaryResultY=y)])
    assert result["verdict"] == "fail"
    assert any("outside viewport" in r for r in result["failReasons"])


@given(
    viewport_height=st.integers(min_value=200, max_value=2000),
    y=st.integers(min_value=0, max_value=150),
)
@settings(max_examples=80, suppress_health_check=[HealthCheck.too_slow])
def test_control_above_fold_with_visible_result_passes(
    viewport_height: int, y: int
) -> None:
    """A control above the fold with a visible result always passes."""
    # Keep y strictly inside the viewport.
    y_in = min(y, viewport_height - 1)
    result = decide(
        [
            base_obs(
                viewportHeight=viewport_height,
                primaryResultY=y_in,
                primaryActionAboveFold=True,
                brandMarkHeight=72,
                truncatedElementCount=0,
            )
        ]
    )
    assert result["verdict"] == "pass", result


@given(n_noise=st.integers(min_value=0, max_value=30))
@settings(max_examples=40, suppress_health_check=[HealthCheck.too_slow])
def test_verdict_invariant_to_duplicate_good_observations(n_noise: int) -> None:
    """
    Verdict is invariant to how many good observations are measured --
    a page with many nodes judged the same way must still pass.
    """
    good = base_obs()
    obs = [good for _ in range(max(1, n_noise))]
    result = decide(obs)
    assert result["verdict"] == "pass"


@given(
    viewport_height=st.integers(min_value=100, max_value=1200),
    y=st.integers(min_value=0, max_value=5000),
    brand=st.integers(min_value=0, max_value=100),
    trunc=st.integers(min_value=0, max_value=5),
    above=st.booleans(),
)
@settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
def test_never_pass_when_primary_result_off_screen(
    viewport_height: int,
    y: int,
    brand: int,
    trunc: int,
    above: bool,
) -> None:
    """No combination of metrics yields pass when the primary result is off-screen."""
    if y < viewport_height:
        return  # not off-screen; property does not apply
    result = decide(
        [
            base_obs(
                viewportHeight=viewport_height,
                primaryResultY=y,
                brandMarkHeight=brand,
                truncatedElementCount=trunc,
                primaryActionAboveFold=above,
            )
        ]
    )
    assert result["verdict"] == "fail"
    assert any("outside viewport" in r or "missing" in r for r in result["failReasons"])


def test_known_bad_below_fold_fixture() -> None:
    """Session defect encoded as fixture: y=1942 in 900px viewport fails."""
    # brandMarkHeight is deliberately compliant (72 at this width). It used to be
    # 48, which is itself below the floor, so this fixture failed for two reasons
    # at once and would still have gone green if the below-fold rule it exists to
    # pin had stopped working entirely.
    result = decide(
        [
            base_obs(
                viewportHeight=900,
                primaryResultY=1942,
                brandMarkHeight=72,
                primaryActionAboveFold=True,
            )
        ]
    )
    assert result["verdict"] == "fail"
    assert any("outside viewport" in r for r in result["failReasons"]), result


def test_known_good_in_view_fixture() -> None:
    """Fixed page with result beside the input passes."""
    result = decide([base_obs(viewportHeight=900, primaryResultY=80)])
    assert result["verdict"] == "pass"
