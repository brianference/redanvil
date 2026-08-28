# RedAnvil — LinkedIn new-project post

Captured 2026-08-28. All six URLs returned 200 and all screenshots in this
folder were taken from the live sites on that date.

---

🔨 New Project: RedAnvil, an app factory that refuses to pass its own apps 🤖

Six apps forged from a prompt. All six are deployed and serving. All six
currently score 0, and that is the point.

What it does:
• Describe an app in plain language, answer four short questions, and get a downloadable PRD with acceptance criteria, a data model, a test plan and a ready-to-paste build prompt
• Runs an autonomous build loop: Grok Build writes the code, Claude reviews the real diff and runs the gate, failures feed back, repeat
• Scores every app against 96 rules across nine lanes: typing, concision, security, hygiene, frontend, testing, CI, process and the loop gate
• Verifies design from screenshots at 375, 768 and 1280 px in both themes, with contrast measured by axe-core rather than inferred from the source
• Publishes a dashboard showing each run's score, rules evaluated and iterations, read live from the results feed
• Runs overnight unattended with checkpointing, so a usage limit pauses the loop instead of ending it
• Routes the four human gates through n8n, with Telegram approval and a signed resume link

Built for honesty, not for the demo:
• Unknown means fail. A rule with no recorded outcome does not quietly pass
• 69 of the 96 rules are blockers, and one open blocker zeroes the whole score. So 0 reads as "not finished", never as "nothing works"
• Verdicts expire when the code they vouch for changes, so a good score cannot outlive the commit that earned it
• Every judge verdict cites file:line evidence, and each evidence path is checked to exist on disk
• The judge tier is capped at 30% of tier-2 weight, so taste can never outvote the deterministic checks
• CI reproduces the whole result rule by rule instead of trusting the committed file
• The README keeps its own retractions. An earlier 100/100 is left in place next to the 0 that replaced it when the rubric grew from 41 rules to 96

The six live apps: an app builder, a run dashboard, an Arizona planting calendar
grounded in UA Cooperative Extension data and NOAA frost normals, a flight search
with a cheapest-day calendar, a sushi finder, and a pet sitter marketplace.

Most build tools show you the run that went well. This one publishes the scoreboard
that says it is not done.

Links in the comments. #AIEngineering #ProductManagement #VibeCoding

---

## Media order for the carousel

1. `00-banner.png` — brand banner
2. `02-dashboard.png` — the live scoreboard: 5 runs, 0 passed, with the note explaining what a 0 means
3. `01-app-builder.png` — prompt to PRD, the four-question wizard
4. `03-az-planting-calendar.png` — real sourced data and a grounded assistant
5. `04-quickflight.png` — cheapest-day calendar and plain-English search
6. `05-sushi-finder.png` — editorial layout
7. `06-pet-sitter.png` — marketplace layout

Lead with the dashboard if you want the honesty angle to land first; lead with the
banner if you want the brand to.

## Links for the first comment

- Repo: https://github.com/brianference/redanvil
- App builder: https://redanvil.pages.dev
- Dashboard: https://redanvil-dashboard.pages.dev
- AZ Planting Calendar: https://az-planting-calendar.pages.dev
- QuickFlight: https://quickflight.pages.dev
- Sushi Finder: https://sushi-finder.pages.dev
- Pet Sitter: https://pet-sitter-vz1.pages.dev

## Where each claim came from

| Claim | Verified by |
| --- | --- |
| 96 rules across nine lanes | `npm run rubric` on 2026-08-28 |
| 69 blockers; one zeroes the score | README "Scores, and why every app currently reads 0" |
| Six apps live | `curl` to all six, every one returned 200 |
| 5 runs, 0 passed | `results/all.json` and the live dashboard screenshot |
| Judge capped at 30% of tier-2 weight | `npm run rubric` prints 30.2% raw, 30.0% applied |
| Zero console errors | Playwright capture; 5 of 6 clean, Pet Sitter logs one CSP warning |
| Telegram approval, overnight runs, n8n gates | commits 63ae588, 034e081, 894abf6 |
