import { describe, it, expect } from 'vitest';
import { generatePrd } from './prd';
import { estimate } from './estimate';

const cost = estimate({ features: 3, hasAuth: true, entities: 2 });
const prd = generatePrd(
  {
    prompt: 'Build an app for tracking tesla driving stats',
    appType: 'dashboard',
    hasAuth: true,
    entities: 'trips, drivers'
  },
  cost
);

/**
 * Extract the first fenced yaml block body from markdown.
 */
function firstYamlFence(markdown: string): string | null {
  const match = markdown.match(/```yaml\n([\s\S]*?)\n```/);
  return match?.[1] ?? null;
}

describe('generatePrd', () => {
  it('derives a schema-valid slug, non-empty title, and original prompt', () => {
    expect(prd.slug).toMatch(/^[a-z0-9][a-z0-9-]+$/);
    expect(prd.title.length).toBeGreaterThan(0);
    expect(prd.prompt).toBe('Build an app for tracking tesla driving stats');
  });

  it('does not truncate titles mid-phrase and embeds the full title in the markdown H1', () => {
    const long = generatePrd(
      {
        prompt: 'A Shift Scheduling app for Small Businesses with employee roles and swaps',
        appType: 'internal tool',
        hasAuth: true,
        entities: 'shifts, employees'
      },
      cost
    );
    // Must not end mid-word on the old 6-word cut ("…for Small")
    expect(long.title).not.toMatch(/for Small$/);
    expect(long.title.toLowerCase()).toContain('shift');
    expect(long.markdown.startsWith(`# Implementation Spec — ${long.title}`)).toBe(true);
    // No ellipsis stuffed into the markdown heading
    expect(long.markdown.split('\n')[0]).not.toContain('…');
    expect(long.markdown.split('\n')[0]).not.toContain('...');
  });

  it('includes the required agentic PRD sections', () => {
    const md = prd.markdown.toLowerCase();
    for (const section of [
      'non-goals',
      'interface contract',
      'features with acceptance criteria',
      'task breakdown',
      'constraints checklist',
      'verification and gates',
      'initial build prompt'
    ]) {
      expect(md, section).toContain(section);
    }
    // Target users is deliberately dropped from the coder paste
    expect(md).not.toContain('## 3. target users');
    expect(md).not.toContain('## target users');
  });

  it('embeds a parseable machine frontmatter yaml block first after the H1', () => {
    const yaml = firstYamlFence(prd.markdown);
    expect(yaml).not.toBeNull();
    expect(yaml!).toContain('targetType: fullstack-web');
    expect(yaml!).toContain('threshold: 90');
    expect(yaml!).toContain('hasAuth: true');
    expect(yaml!).toContain('appType: "dashboard"');
    expect(yaml!).toMatch(/slug: "/);
    expect(yaml!).toMatch(/title: "/);
    expect(yaml!).toMatch(/entities: \[/);
    // Frontmatter appears before non-goals / features
    const yamlAt = prd.markdown.indexOf('```yaml');
    const nonGoalsAt = prd.markdown.indexOf('## 2. Non-goals');
    expect(yamlAt).toBeGreaterThan(-1);
    expect(yamlAt).toBeLessThan(nonGoalsAt);
  });

  it('emits real CREATE TABLE DDL for each entity (no placeholder columns)', () => {
    expect(prd.markdown).toContain('CREATE TABLE IF NOT EXISTS trips');
    expect(prd.markdown).toContain('CREATE TABLE IF NOT EXISTS drivers');
    expect(prd.markdown).toContain('CREATE TABLE IF NOT EXISTS users');
    expect(prd.markdown).toContain('id TEXT PRIMARY KEY');
    expect(prd.markdown).toContain('created_at TEXT NOT NULL');
    expect(prd.markdown).toContain('title TEXT NOT NULL');
    expect(prd.markdown).toContain('user_id TEXT NOT NULL');
    expect(prd.markdown).not.toMatch(/fields specific to/i);
  });

  it('lists API routes and Zod schema names per entity', () => {
    expect(prd.markdown).toContain('GET | `/api/trips`');
    expect(prd.markdown).toContain('POST | `/api/trips`');
    expect(prd.markdown).toContain('GET | `/api/trips/:id`');
    expect(prd.markdown).toContain('TripCreateSchema');
    expect(prd.markdown).toContain('DriverCreateSchema');
  });

  it('gives each feature an ID and GIVEN/WHEN/THEN acceptance line', () => {
    expect(prd.markdown).toMatch(/### F1 —/);
    expect(prd.markdown).toMatch(/### F2 —/);
    expect(prd.markdown).toMatch(/### F3 —/);
    // Every feature block should carry scenario acceptance
    const acceptanceBlocks = prd.markdown.match(/\*\*Acceptance:\*\* GIVEN .+ WHEN .+ THEN .+/g);
    expect(acceptanceBlocks).not.toBeNull();
    expect(acceptanceBlocks!.length).toBeGreaterThanOrEqual(4);
    expect(prd.markdown).toMatch(/\*\*Verify:\*\* (unit|Playwright|curl)/);
  });

  it('includes a dependency-ordered task list with verify commands', () => {
    expect(prd.markdown).toContain('**T1**');
    expect(prd.markdown).toContain('**T4**');
    expect(prd.markdown).toContain('npx tsc --noEmit');
    expect(prd.markdown).toContain('/api/health');
    expect(prd.markdown).toMatch(/npm run gate -- .+ --threshold 90/);
  });

  it('names exact verification gate commands and threshold 90', () => {
    expect(prd.markdown).toContain('npx tsc --noEmit');
    expect(prd.markdown).toContain('npx eslint . --max-warnings 0');
    expect(prd.markdown).toContain('npx vitest run');
    expect(prd.markdown).toContain('npm run build');
    expect(prd.markdown).toContain('curl -sf http://127.0.0.1:<port>/api/health');
    expect(prd.markdown).toContain(`npm run gate -- ${prd.slug} --threshold 90`);
    expect(prd.markdown).toMatch(/score >= \*\*90\*\*|threshold 90/);
  });

  it('tightens the build prompt to reference section numbers and F# / T#', () => {
    const promptSection = prd.markdown.split('## 8. Initial build prompt')[1] ?? '';
    expect(promptSection).toContain('§5');
    expect(promptSection).toContain('§3');
    expect(promptSection).toContain('§4');
    expect(promptSection).toContain('§7');
    expect(promptSection).toContain('§2');
    expect(promptSection).toMatch(/T1→T11/);
    expect(promptSection).toContain('F1');
  });

  it('embeds the enforced Cloudflare stack and the user entities', () => {
    expect(prd.markdown).toContain('Cloudflare');
    expect(prd.markdown).toContain('Web Crypto');
    expect(prd.markdown.toLowerCase()).toContain('trips');
  });

  it('omits auth tables and scopes non-goals when hasAuth is false', () => {
    const publicPrd = generatePrd(
      {
        prompt: 'an app to remind you when your dog needs grooming, vet visits, ear cleaning',
        appType: 'Mobile app',
        hasAuth: false,
        entities: 'Reminder, Pet'
      },
      estimate({ features: 3, hasAuth: false, entities: 2 })
    );
    expect(publicPrd.markdown).toContain('hasAuth: false');
    expect(publicPrd.markdown).toContain('No authentication');
    expect(publicPrd.markdown).toContain('CREATE TABLE IF NOT EXISTS reminders');
    expect(publicPrd.markdown).toContain('CREATE TABLE IF NOT EXISTS pets');
    expect(publicPrd.markdown).not.toContain('CREATE TABLE IF NOT EXISTS users');
    expect(publicPrd.markdown).toContain('Public access');
    expect(publicPrd.markdown).toMatch(/T1→T10/);
    // user_id only appears in domain tables when auth is on
    expect(publicPrd.markdown).not.toMatch(/user_id TEXT NOT NULL/);
  });

  it('is deterministic for the same answers and estimate', () => {
    const again = generatePrd(
      {
        prompt: 'Build an app for tracking tesla driving stats',
        appType: 'dashboard',
        hasAuth: true,
        entities: 'trips, drivers'
      },
      cost
    );
    expect(again.markdown).toBe(prd.markdown);
    expect(again.slug).toBe(prd.slug);
    expect(again.title).toBe(prd.title);
  });
});

describe('generatePrd sample: dog care reminders', () => {
  const sample = generatePrd(
    {
      prompt: 'an app to remind you when your dog needs grooming, vet visits, ear cleaning',
      appType: 'Mobile app',
      hasAuth: false,
      entities: 'Reminder, Pet'
    },
    estimate({ features: 3, hasAuth: false, entities: 2 })
  );

  it('produces a full agentic PRD for the dog-care input', () => {
    expect(sample.slug).toMatch(/dog|grooming|remind/);
    expect(sample.title.length).toBeGreaterThan(0);
    expect(firstYamlFence(sample.markdown)).toContain('Mobile app');
    expect(sample.markdown).toContain('CREATE TABLE IF NOT EXISTS reminders');
    expect(sample.markdown).toContain('CREATE TABLE IF NOT EXISTS pets');
    expect(sample.markdown).toContain('ReminderCreateSchema');
    expect(sample.markdown).toContain('PetCreateSchema');
    expect(sample.markdown).toMatch(/\*\*Acceptance:\*\* GIVEN/);
    expect(sample.markdown).toContain('**T1**');
    expect(sample.markdown).toContain('npm run gate --');
    expect(sample.markdown).toContain('--threshold 90');
  });
});
