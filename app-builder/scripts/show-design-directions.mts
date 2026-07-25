/**
 * Print the design direction chosen for a spread of app ideas.
 *
 * A quick way to see whether the variation is real without generating eight
 * whole PRDs. If this ever prints the same archetype down the column, the
 * design-direction module has stopped doing its job.
 *
 * Usage: npx tsx scripts/show-design-directions.mts
 */
import { chooseDesignDirection } from '../src/lib/prd/sections/design';

const apps: readonly (readonly [string, string, string])[] = [
  ['field service app, techs log jobs offline', 'mobile', 'jobs, techs'],
  ['B2B invoice tracker with Stripe status', 'dashboard', 'invoices, customers'],
  ['parent coach app with daily prompts', 'mobile', 'prompts, children'],
  ['marketplace for local makers', 'marketplace', 'listings, makers'],
  ['status page for uptime', 'dashboard', 'services'],
  ['shift scheduling for small teams', 'dashboard', 'shifts, staff'],
  ['reading list with highlights and tags', 'mobile', 'books, highlights'],
  ['plant watering reminders', 'mobile', 'plants']
];

for (const [prompt, appType, entities] of apps) {
  const d = chooseDesignDirection(`${prompt}|${appType}|${entities}`);
  console.log(`${prompt.slice(0, 40).padEnd(42)} ${d.archetype.name.padEnd(20)} ${d.visual.name}`);
}
