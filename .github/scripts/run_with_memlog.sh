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
  local used
  while [ "$i" -lt "$MAX_SAMPLES" ]; do
    # available is the number that matters: a runner dies when the KERNEL runs
    # out, not when one process is large.
    used=$(free -m | awk '/^Mem:/ {print $3}')
    echo "[mem $(date -u +%H:%M:%S)] $(free -m | awk '/^Mem:/ {print "used="$3"MB available="$7"MB"}')"
    # Name the culprit. The first trace this produced showed memory climbing
    # ~2GB every 10s from 2.4GB to 12.6GB, which proved the runner was OOMing
    # but not WHAT was allocating -- the gate buffers its output, so no rule
    # name reaches the log before the kill. Once past 3GB, print the top RSS
    # consumers so the next failure names the process instead of implying one.
    if [ "${used:-0}" -gt 3000 ]; then
      ps -eo rss=,comm=,args= --sort=-rss 2>/dev/null | head -5 |
        awk '{ printf "[top %6.0fMB] %s\n", $1/1024, substr($0, index($0,$2)) }' |
        cut -c1-160
      # The tmpfs/shm hypothesis is DISPROVEN by its own trace, and the reasoning
      # that produced it was wrong in a specific way worth naming. Run
      # 31998485260 recorded shared=45MB, /dev/shm used=0MB, and buff_cache flat
      # at ~5GB while `used` climbed 2016MB -> 12665MB. No filesystem filled RAM.
      #
      # "The memory is NOT in any process" was an over-read of `head -5`. Sorting
      # by RSS and taking the top five cannot see a THOUSAND processes of 5MB:
      # they sum to 5GB while every individual one is far too small to print. So
      # top-5 being small never ruled a process explanation out -- it only ruled
      # out a single fat one.
      #
      # The signal that was in the log all along is the ending:
      #   fork: retry: Resource temporarily unavailable
      # That is EAGAIN from fork(2) -- the pid/thread limit, i.e. process
      # exhaustion. Climbing memory plus fork EAGAIN plus a small top-5 is the
      # signature of unbounded spawning, not a leak and not a heap cap.
      #
      # So COUNT them and SUM them. total_rss vs `used` is the discriminator that
      # settles it in one run: if total_rss tracks `used`, the memory is in
      # processes after all and `nproc` names how many; if total_rss stays small
      # while `used` climbs, it is genuinely kernel-side and this is still open.
      free -m | awk '/^Mem:/ { printf "[memdetail] shared=%sMB buff_cache=%sMB\n", $5, $6 }'
      ps -eo rss= 2>/dev/null |
        awk '{ s += $1; n += 1 } END { printf "[procs] count=%d total_rss=%.0fMB\n", n, s/1024 }'
      # Which executable is multiplying. A fork bomb shows one name with a huge
      # count; a normal runner shows a flat spread in the low tens.
      ps -eo comm= 2>/dev/null | sort | uniq -c | sort -rn | head -5 |
        awk '{ printf "[byname] %5d x %s\n", $1, $2 }'
      # -P forces one line per filesystem. Without it a long device name WRAPS,
      # $6 lands on the wrong field, and the /tmp row silently never printed --
      # which is why the previous run only ever showed /dev/shm.
      df -Pm /dev/shm /tmp 2>/dev/null | awk 'NR>1 { printf "[fs] %s used=%sMB avail=%sMB\n", $6, $3, $4 }'
    fi
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
