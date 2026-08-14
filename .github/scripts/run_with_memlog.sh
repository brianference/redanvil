#!/usr/bin/env bash
# Run a command while printing system memory every 10s, so a step the runner
# KILLS leaves a trace instead of nothing.
#
# Why this exists: `verify_results.mjs app-builder` has been killed repeatedly
# in results-provenance, and the step records as `cancelled` with ZERO output --
# no gate output, no error, nothing to read. Two runs at the same 2048 heap cap
# disagreed (one passed, the next was killed at 2m13s), so the cap is not the
# variable and a third guess would be worth no more than the first two. The
# sampler prints as it goes, so its lines survive the kill and the next failure
# shows whether memory was actually climbing and how fast.
#
# Deliberately not `/usr/bin/time -v`: it reports peak RSS only when the process
# exits, which is exactly the case that does not happen here.
set -u

# Bounded, NOT `while true`. The first version of this looped forever and left
# the step running for 39 minutes against a 2m13s baseline before it was
# cancelled by hand. If the kernel kills the shell rather than the child, the
# EXIT trap never runs -- SIGKILL cannot be trapped -- so the sampler is orphaned
# still holding the step's stdout open, and Actions waits on that pipe with no
# process left to produce output. An unbounded background writer turns a fast,
# visible failure into an indefinite hang, which is strictly worse than the
# problem it was added to diagnose. 90 samples at 10s is 15 minutes, comfortably
# past the ~2-3 minute mark where this step dies, and it terminates on its own.
readonly MAX_SAMPLES=90

log_memory() {
  local i=0
  while [ "$i" -lt "$MAX_SAMPLES" ]; do
    # available is the number that matters: a runner dies when the KERNEL runs
    # out, not when one process is large.
    echo "[mem $(date -u +%H:%M:%S)] $(free -m | awk '/^Mem:/ {print "used="$3"MB available="$7"MB"}')"
    sleep 10
    i=$((i + 1))
  done
}

log_memory &
sampler=$!
# Kill the sampler however we leave, including when this script is signalled.
trap 'kill "$sampler" 2>/dev/null || true' EXIT

"$@"
status=$?

echo "[mem $(date -u +%H:%M:%S)] command exited ${status}; $(free -m | awk '/^Mem:/ {print "used="$3"MB available="$7"MB"}')"
exit "$status"
