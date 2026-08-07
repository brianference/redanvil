# Reuse scan — booking, availability and scheduling

Run 2026-08-07, before building pet-sitter's booking flow. Required by the
`reuse` process step. Base rule 3: use what exists before writing anything.

**Why this exists.** pet-sitter reached production as a browsable directory with
no booking flow at all, hand-rolled, while maintained implementations sat
unexamined. The rule was already written; it was enforced by memory, which is not
enforcement. This scan is now a blocking artifact.

## The binding constraint

The target runtime is **Cloudflare Pages Functions + D1**. That eliminates most
candidates before licence even matters: anything requiring a long-running Node
server, native modules, or PostgreSQL cannot be a dependency here. It can still
be a *reference architecture*, which is a different and still-valuable verdict.

## Candidates

| # | Project | What it is | Licence | Verdict |
|---|---------|-----------|---------|---------|
| 1 | [FullCalendar](https://github.com/topics/booking?l=typescript) | Calendar/scheduler UI component, ~11.4k stars | MIT | **Reject as dependency, adopt the interaction model** |
| 2 | [Tui Calendar](https://github.com/topics/booking?l=typescript) | Calendar UI, ~8.2k stars, React/Vue/Angular wrappers | MIT | **Reject** |
| 3 | [alanbickel/booking-calendar](https://github.com/alanbickel/booking-calendar) | Minimal JS/PHP booking + event calendar, full-day booking, at-a-glance availability | not verified | **Reject as dependency, read for the availability model** |
| 4 | [DayPilot](https://javascript.daypilot.org/open-source/) | Scheduler/Gantt components, NPM packages across frameworks | open-source tier + commercial | **Reject** |
| 5 | [cal.com](https://github.com/calcom/cal.com) | Full self-hosted scheduling platform | **NOT VERIFIED** — a fetch of the repo returned details for the *Cal.diy* fork (MIT) and characterised cal.com as "Open Core". Do not rely on this line without checking the LICENSE file directly. | **Reject as dependency, adopt as reference architecture** |

## Reasoning per verdict

**1, 2, 4 — calendar UI components.** All three solve rendering a calendar, which
is the part pet-sitter already has: the Dates view ships a working month grid with
per-day availability dots and a 44px hit area, built to the approved design.
Adopting one would mean discarding an approved design to inherit a generic one,
and adding a dependency to replace working code. That is the wrong trade. What is
worth taking from FullCalendar is its **interaction model** — range selection
semantics, and how it represents a day that is partially available — which is
design guidance, not code.

**3 — booking-calendar.** Closest in spirit: minimal, full-day booking, an
at-a-glance availability overview. Wrong stack (JS/PHP) and the licence was not
verified, so it cannot be a dependency. Worth reading for how it models a booked
range against an available range, which is the part pet-sitter has not built.

**5 — cal.com.** The reference implementation for scheduling as a product, and the
right thing to study for the booking **state machine**: request → pending →
confirmed → cancelled, double-booking prevention, and timezone handling. But it
is a full Next.js + PostgreSQL application, not an embeddable library, and the
target is Workers + D1. Reject as a dependency on architecture grounds alone.

## What pet-sitter actually needs, and what is genuinely missing

The gap is **not** a calendar widget. It is:

1. A `booking` table in D1 with a state machine and a uniqueness constraint that
   makes double-booking impossible at the database level, not in application code
2. `POST /api/bookings` with Zod validation and parameterised D1 writes
3. Conflict detection against `sitter.available_from`/`available_to` and existing
   bookings
4. A booking UI reachable from the sitter detail page, with confirmation before a
   commitment, and real loading/error/empty states

None of the five candidates supplies that on this runtime. **Build it, informed by
cal.com's state machine and booking-calendar's availability model.** That is a
legitimate scan outcome — a scan that rejects everything is fine; a scan that
never happened is not.

## Still to verify before implementation

- cal.com's actual LICENSE file, read directly, if any code or schema is copied
  rather than merely referenced
- Whether a Workers-compatible date/timezone library is needed, or whether
  `Intl` plus ISO date strings suffice given D1 stores dates as text
