"""Non-vacuous proofs for Round 2 batch B items 2, 3, 4. Restores all edits."""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def run(cmd: list[str], cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    # shell=True so Windows can resolve npx.cmd / node from PATH
    if len(cmd) == 1:
        cmdline = cmd[0]
    else:
        cmdline = subprocess.list2cmdline(cmd)
    return subprocess.run(
        cmdline,
        cwd=str(cwd or ROOT),
        capture_output=True,
        text=True,
        shell=True,
    )


def npx_vitest(args: list[str], cwd: Path) -> subprocess.CompletedProcess[str]:
    return run(["npx", "vitest", "run", *args], cwd=cwd)


def banner(title: str) -> None:
    print(f"\n=== {title} ===")


def proof_wizard() -> bool:
    banner("PROOF 2 wizardInstanceKey")
    wiz = ROOT / "app-builder/src/lib/wizardSession.ts"
    home = ROOT / "app-builder/src/pages/Home.tsx"
    wiz_orig = wiz.read_text(encoding="utf-8")
    home_orig = home.read_text(encoding="utf-8")
    ab = ROOT / "app-builder"
    ok = True

    try:
        # Baseline must pass
        r = npx_vitest(["src/lib/wizardSession.test.ts"], ab)
        print(f"2baseline exit={r.returncode} pass_expected={'YES' if r.returncode == 0 else 'NO'}")
        if r.returncode != 0:
            print(r.stdout)
            print(r.stderr)
            ok = False

        # 2a: break format
        t = wiz_orig.replace(
            "return `wizard-${sessionId}-${startStep}`;",
            "return `wiz-${sessionId}-${startStep}`;",
        )
        assert t != wiz_orig, "format break did not apply"
        wiz.write_text(t, encoding="utf-8")
        r = npx_vitest(["src/lib/wizardSession.test.ts"], ab)
        good = r.returncode != 0
        print(f"2a format-break exit={r.returncode} fail_expected={'YES' if good else 'NO'}")
        if "wizard-2-1" in (r.stdout + r.stderr) or "Expected" in (r.stdout + r.stderr):
            print("2a saw assertion failure on exact format")
        ok = ok and good
        wiz.write_text(wiz_orig, encoding="utf-8")

        # 2b: break arity (required third arg)
        t = wiz_orig.replace(
            "export function wizardInstanceKey(sessionId: number, startStep: 1 | 2 | 3): string {",
            "export function wizardInstanceKey(sessionId: number, startStep: 1 | 2 | 3, prompt: string): string {",
        ).replace(
            "return `wizard-${sessionId}-${startStep}`;",
            "return `wizard-${sessionId}-${startStep}-${prompt}`;",
        )
        assert "prompt: string" in t
        wiz.write_text(t, encoding="utf-8")
        r = npx_vitest(["src/lib/wizardSession.test.ts"], ab)
        good = r.returncode != 0
        print(f"2b arity-break exit={r.returncode} fail_expected={'YES' if good else 'NO'}")
        combined = r.stdout + r.stderr
        if "toBe(2)" in combined or "length" in combined or "Expected" in combined:
            print("2b saw arity assertion failure")
        ok = ok and good
        wiz.write_text(wiz_orig, encoding="utf-8")

        # 2c: Home.tsx key concatenates prompt
        old = "key={wizardInstanceKey(wizardSessionId, wizardStartStep)}"
        new = "key={wizardInstanceKey(wizardSessionId, wizardStartStep) + answers.prompt}"
        assert old in home_orig, "Home.tsx key expression not found"
        home.write_text(home_orig.replace(old, new), encoding="utf-8")
        r = npx_vitest(["src/lib/wizardSession.test.ts"], ab)
        good = r.returncode != 0
        print(f"2c Home key+prompt exit={r.returncode} fail_expected={'YES' if good else 'NO'}")
        combined = r.stdout + r.stderr
        if "prompt" in combined.lower() or "Home" in combined:
            print("2c saw Home.tsx key regression")
        ok = ok and good
        home.write_text(home_orig, encoding="utf-8")

        # restore + baseline
        wiz.write_text(wiz_orig, encoding="utf-8")
        home.write_text(home_orig, encoding="utf-8")
        r = npx_vitest(["src/lib/wizardSession.test.ts"], ab)
        good = r.returncode == 0
        print(f"2d restored baseline exit={r.returncode} pass_expected={'YES' if good else 'NO'}")
        ok = ok and good
    finally:
        wiz.write_text(wiz_orig, encoding="utf-8")
        home.write_text(home_orig, encoding="utf-8")

    return ok


def proof_dual_fixtures() -> bool:
    banner("PROOF 3 dual fixtures")
    checks = ROOT / "orchestrator/test/checks.test.ts"
    check_mjs = ROOT / "orchestrator/scripts/checks/check.mjs"
    orig = checks.read_text(encoding="utf-8")
    mjs = check_mjs.read_text(encoding="utf-8")
    cases = re.findall(r"case '([^']+)':", mjs)
    ok = True

    print("check.mjs rules:", cases)
    for c in cases:
        idxs = [m.start() for m in re.finditer(rf"runCheck\('{re.escape(c)}'", orig)]
        flags: list[str] = []
        for i in idxs:
            window = orig[i : i + 220]
            if ".not.toBe(0)" in window:
                flags.append("fail")
            elif ".toBe(0)" in window:
                flags.append("pass")
            else:
                flags.append("other")
        dual = "fail" in flags and "pass" in flags
        print(f"  dual[{c}]={dual} flags={flags}")
        if not dual:
            ok = False

    # Invert hyg-no-duplication dual pair
    broken = orig
    broken = broken.replace(
        """    const r = runCheck('hyg-no-duplication', app);
    expect(r.status, r.stderr).not.toBe(0);
    expect(r.stderr).toMatch(/duplicated code/i);
  });

  it('passes when two pages share only style-token property runs', () => {""",
        """    const r = runCheck('hyg-no-duplication', app);
    expect(r.status, r.stderr).toBe(0); // inverted defective
    expect(r.stderr).toMatch(/duplicated code/i);
  });

  it('passes when two pages share only style-token property runs', () => {""",
    )
    # Only flip the final clean assertion of the hyg-no-duplication describe
    marker = "describe('check.mjs — hyg-no-duplication'"
    start = broken.find(marker)
    assert start != -1
    tail = broken[start:]
    # last toBe(0) in that describe before closing
    last_pass = tail.rfind("expect(r.status, r.stderr).toBe(0);")
    assert last_pass != -1
    abs_i = start + last_pass
    broken = (
        broken[:abs_i]
        + "expect(r.status, r.stderr).not.toBe(0); // inverted clean"
        + broken[abs_i + len("expect(r.status, r.stderr).toBe(0);") :]
    )
    assert broken != orig
    checks.write_text(broken, encoding="utf-8")
    try:
        r = npx_vitest(
            ["orchestrator/test/checks.test.ts", "-t", "hyg-no-duplication"],
            ROOT,
        )
        good = r.returncode != 0
        print(f"inverted dual-fixture exit={r.returncode} fail_expected={'YES' if good else 'NO'}")
        for line in (r.stdout + r.stderr).splitlines():
            if any(x in line for x in ("FAIL", "failed", "Tests ", "Test Files", "×", "AssertionError")):
                print(line)
        ok = ok and good
    finally:
        checks.write_text(orig, encoding="utf-8")

    r = npx_vitest(
        ["orchestrator/test/checks.test.ts", "-t", "hyg-no-duplication"],
        ROOT,
    )
    good = r.returncode == 0
    print(f"restored dual-fixture exit={r.returncode} pass_expected={'YES' if good else 'NO'}")
    for line in (r.stdout + r.stderr).splitlines():
        if "Tests " in line or "Test Files" in line:
            print(line)
    ok = ok and good

    # app-builder itself passes hyg-no-duplication
    r = run(
        [sys.executable.replace("python", "node") if False else "node",
         str(ROOT / "orchestrator/scripts/checks/check.mjs"),
         "hyg-no-duplication",
         str(ROOT / "app-builder")],
    )
    # use node explicitly
    r = run(["node", str(ROOT / "orchestrator/scripts/checks/check.mjs"), "hyg-no-duplication", "app-builder"])
    good = r.returncode == 0
    print(f"app-builder hyg-no-duplication exit={r.returncode} pass_expected={'YES' if good else 'NO'}")
    if r.stderr:
        print(r.stderr[:500])
    ok = ok and good
    return ok


def proof_estimate() -> bool:
    banner("PROOF 4 estimate")
    est = ROOT / "app-builder/src/lib/estimate.ts"
    orig = est.read_text(encoding="utf-8")
    ab = ROOT / "app-builder"
    ok = True

    def run_est() -> subprocess.CompletedProcess[str]:
        return npx_vitest(["src/lib/estimate.test.ts"], ab)

    try:
        r = run_est()
        print(f"4baseline exit={r.returncode} pass_expected={'YES' if r.returncode == 0 else 'NO'}")
        ok = ok and r.returncode == 0

        # 4a calibrated pin
        broken = orig.replace("const BASE_TOKENS = 120_000;", "const BASE_TOKENS = 100_000;")
        assert broken != orig
        est.write_text(broken, encoding="utf-8")
        r = run_est()
        good = r.returncode != 0
        print(f"4a calibrated-pin break exit={r.returncode} fail_expected={'YES' if good else 'NO'}")
        for line in (r.stdout + r.stderr).splitlines():
            if any(x in line for x in ("pins a calibrated", "504", "Expected", "FAIL", "Tests ")):
                print(line)
        ok = ok and good

        # 4b strict increase (features/entities)
        broken = orig.replace(
            "entities * TOKENS_PER_ENTITY +",
            "0 * TOKENS_PER_ENTITY +",
        ).replace(
            "Math.ceil(features / 2) + Math.ceil(entities / 3) + authExtra",
            "Math.ceil(features / 2) + 0 + authExtra",
        )
        est.write_text(broken, encoding="utf-8")
        r = run_est()
        good = r.returncode != 0
        print(f"4b strict-increase break exit={r.returncode} fail_expected={'YES' if good else 'NO'}")
        for line in (r.stdout + r.stderr).splitlines():
            if any(x in line for x in ("strictly increases", "entities", "Expected", "FAIL", "Tests ")):
                print(line)
        ok = ok and good

        # 4c auth delta
        broken = orig.replace("const authExtra = input.hasAuth ? 1 : 0;", "const authExtra = 0;")
        est.write_text(broken, encoding="utf-8")
        r = run_est()
        good = r.returncode != 0
        print(f"4c auth-delta break exit={r.returncode} fail_expected={'YES' if good else 'NO'}")
        for line in (r.stdout + r.stderr).splitlines():
            if any(x in line.lower() for x in ("auth", "expected", "fail", "tests ")):
                print(line)
        ok = ok and good

        # 4d confidence
        broken = orig.replace(
            "const confidence: EstimateConfidence = weight <= 3 ? 'high' : weight <= 8 ? 'medium' : 'low';",
            "const confidence: EstimateConfidence = 'high';",
        )
        est.write_text(broken, encoding="utf-8")
        r = run_est()
        good = r.returncode != 0
        print(f"4d confidence break exit={r.returncode} fail_expected={'YES' if good else 'NO'}")
        for line in (r.stdout + r.stderr).splitlines():
            if any(x in line for x in ("confidence", "medium", "low", "Expected", "FAIL", "Tests ")):
                print(line)
        ok = ok and good

        est.write_text(orig, encoding="utf-8")
        r = run_est()
        good = r.returncode == 0
        print(f"4e restored exit={r.returncode} pass_expected={'YES' if good else 'NO'}")
        for line in (r.stdout + r.stderr).splitlines():
            if "Tests " in line or "Test Files" in line:
                print(line)
        ok = ok and good
    finally:
        est.write_text(orig, encoding="utf-8")

    return ok


def main() -> int:
    results = {
        "proof2": proof_wizard(),
        "proof3": proof_dual_fixtures(),
        "proof4": proof_estimate(),
    }
    banner("SUMMARY")
    for k, v in results.items():
        print(f"{k}: {'PASS' if v else 'FAIL'}")
    return 0 if all(results.values()) else 1


if __name__ == "__main__":
    raise SystemExit(main())
