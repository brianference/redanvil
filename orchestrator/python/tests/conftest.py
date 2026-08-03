"""Pytest/hypothesis configuration for the Python lane.

WHY THIS FILE EXISTS
--------------------
These property tests drive the real qa-visual decision by SPAWNING A SUBPROCESS
per generated example. Hypothesis's default per-example deadline is 200ms, and a
process spawn on Windows alone costs more than that -- observed 1776ms, 1994ms,
2201ms and 2494ms in one run. So the deadline was never measuring the property;
it was measuring how busy the machine was, and it failed the moment anything else
was running.

Nothing ran this lane routinely (npm test was `vitest run` alone, and CI ran
vitest twice), so a suite that fails under load sat unnoticed. Wiring the lane
into `npm test` and CI is what surfaced it.

Disabling the deadline does NOT weaken the tests: every generated example still
runs and every property is still asserted. It removes a wall-clock assertion that
was never a meaningful signal for subprocess-backed tests. A genuinely hung test
is still caught -- by pytest's own timeout and by CI's job timeout, which are the
right layers for that.
"""

from __future__ import annotations

try:
    from hypothesis import HealthCheck, settings
except ImportError:  # pragma: no cover - hypothesis absent, tests skip themselves
    settings = None

if settings is not None:
    settings.register_profile(
        "subprocess_backed",
        deadline=None,
        # Each example shells out, so slow-example and slow-data health checks
        # report the same non-signal the deadline did.
        suppress_health_check=[HealthCheck.too_slow],
    )
    settings.load_profile("subprocess_backed")
