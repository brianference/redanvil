<!-- Sections 8 and 9 of dog-care-reminder/docs/PRD.md as generated before the entity spec (the wrong product: a double-booking scheduler). Frontmatter entities: "Reminder" -->
## 8. Core Features (MVP first)

MVP features are the **minimum** set that solves the stated problem. An agent must be able to ship only the MVP set and have a working product. Build MVP first; Beyond MVP only after MVP acceptance is green.

### MVP

### F1 — Schedule Reminder **[MVP]**

Users assign Reminder to a time and a person, and the app refuses assignments that conflict.

### F2 — Browse & search Reminder **[MVP]**

Users can open the reminders list, search by title, and see matching rows or an empty state.

### F3 — Reminder detail **[MVP]**

Clicking a list row opens the full Reminder record with title, description, and a back link. Any external URL from data is rendered only after safeHttpUrl/safeHref validation (no anchor when unsafe).

### F4 — Public access **[MVP]**

No login required; all product pages and APIs are public.

### F5 — Manage Reminder **[MVP]**

Create, edit, and delete reminders with confirmation before delete.

### F6 — Search and filter Reminder **[MVP]**

Users can search or filter the reminders collection with a control whose accessible name matches /search|find|filter/i; the query must narrow the visible results (a decorative box fails).

### F7 — Ask the assistant about Reminder **[MVP]**

A chat affordance reachable from the shell posts to functions/api/assistant.ts (or equivalent). The Worker calls Cloudflare Workers AI (env.AI) and grounds the answer in this app's own data -- not general knowledge. A failed model call surfaces an error state, never an empty success. No secrets in code; the binding comes from env.

## 9. Acceptance Criteria

Each feature has an ID for task and UAT binding. Every bullet is one testable condition; bind each to a named test in §10.

### F1 — Schedule Reminder

**Acceptance criteria**
- GIVEN an open slot WHEN the user assigns it THEN the schedule shows the assignment immediately
- GIVEN an assignment that overlaps an existing one WHEN the user saves THEN it is rejected with the conflicting item named
- GIVEN an assignment WHEN the user cancels it THEN the slot returns to open and the change is visible without a reload

### F2 — Browse & search Reminder

**Acceptance criteria**
- GIVEN seeded reminders exist WHEN the user opens the list THEN each row shows title and a link to detail
- GIVEN seeded reminders exist WHEN the user enters a query that matches one title THEN only matching rows render
- GIVEN no reminders exist WHEN the list loads THEN an empty state explains how to add one
- GIVEN the API returns 500 WHEN the list loads THEN an error message with a retry action is shown

### F3 — Reminder detail

**Acceptance criteria**
- GIVEN a Reminder id that exists in D1 WHEN the user opens /reminders/:id THEN the page shows title, description, and a back link to the list
- GIVEN an unknown id WHEN the user opens /reminders/:id THEN a not-found state with a path back to the list is shown
- GIVEN the API returns 500 WHEN detail loads THEN an error message with a retry action is shown
- GIVEN a detail record whose source/external URL is javascript: or otherwise non-http(s) WHEN the page renders THEN no anchor is emitted for that URL (safeHttpUrl/SafeExternalLink; u-sec-safe-href)

### F4 — Public access

**Acceptance criteria**
- GIVEN an anonymous browser with no cookies WHEN the user visits Home, the list page, and a detail page THEN every page returns 200 without a redirect to login
- GIVEN no session WHEN the client calls list and create APIs THEN requests succeed without auth headers

### F5 — Manage Reminder

**Acceptance criteria**
- GIVEN the manage form is open WHEN the user creates a Reminder with a valid title THEN the list includes the new row
- GIVEN an existing Reminder WHEN the user edits its title and saves THEN the list and detail show the new title
- GIVEN an existing Reminder WHEN the user confirms delete THEN the row is gone from the list
- GIVEN an existing Reminder WHEN the user cancels delete THEN the row remains
- GIVEN invalid input (empty title) WHEN the user submits create THEN a 400 validation message is shown and no row is created

### F6 — Search and filter Reminder

**Acceptance criteria**
- GIVEN seeded reminders exist WHEN the user opens the collection view THEN a search or filter control with an accessible name matching /search|find|filter/i is present
- GIVEN seeded reminders exist WHEN the user enters a query that matches one item THEN only matching rows render
- GIVEN seeded reminders exist WHEN the user enters a query that matches nothing THEN an empty or no-match state is shown (not the full unfiltered list)
- GIVEN the collection API fails WHEN the user is on the collection view THEN an error state with recovery is shown rather than a silent full list

### F7 — Ask the assistant about Reminder

**Acceptance criteria**
- GIVEN the shell is open WHEN the user opens the assistant THEN a chat input is reachable without leaving the product chrome
- GIVEN the assistant endpoint and Workers AI binding are healthy WHEN the user asks a question about Reminder THEN the answer is grounded in app data (DB rows, catalog filters, or structured domain query) rather than generic model knowledge alone
- GIVEN the model call fails (502 / binding missing / empty model output) WHEN the user submits a message THEN an error state is shown -- never an empty success or a silent no-op
- GIVEN invalid input (empty message) WHEN the user submits THEN a 400 validation response is shown and no model call is required
