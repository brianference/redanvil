import { describe, it, expect } from 'vitest';
import { generatePrd, evaluatePrdSelfCheck, PRD_SECTION_HEADINGS } from './prd';
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

/**
 * Index of each standard section heading in order (or -1 if missing).
 */
function sectionPositions(markdown: string): number[] {
  return PRD_SECTION_HEADINGS.map((h) => markdown.indexOf(`## ${h}`));
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

  it('includes all 14 standard sections in order after frontmatter', () => {
    const positions = sectionPositions(prd.markdown);
    for (let i = 0; i < positions.length; i++) {
      expect(positions[i], PRD_SECTION_HEADINGS[i]).toBeGreaterThan(-1);
      if (i > 0) {
        expect(positions[i], `${PRD_SECTION_HEADINGS[i]} after previous`).toBeGreaterThan(
          positions[i - 1]!
        );
      }
    }
    const yamlAt = prd.markdown.indexOf('```yaml');
    expect(yamlAt).toBeGreaterThan(-1);
    expect(yamlAt).toBeLessThan(positions[0]!);
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
  });

  it('keeps architecture, interface contract, design specs under Technical Requirements', () => {
    expect(prd.markdown).toContain('## 7. Technical Requirements');
    expect(prd.markdown).toContain('### 7.1 Architecture');
    expect(prd.markdown).toContain('### 7.2 Interface contract');
    expect(prd.markdown).toContain('### 7.3 Design specifications');
    expect(prd.markdown).toContain('Cloudflare Pages');
    expect(prd.markdown).toContain('Pages Functions');
    expect(prd.markdown).toContain('Browser (SPA)');
    expect(prd.markdown).toContain('No Node-only globals');
    expect(prd.markdown).toContain('375 / 768 / 1280');
    expect(prd.markdown).toContain('theme tokens');
  });

  it('includes Coding standard (must) with RedAnvil non-negotiables', () => {
    expect(prd.markdown).toContain('## 13. Coding Standard (must)');
    expect(prd.markdown.toLowerCase()).toContain('strict typescript');
    expect(prd.markdown.toLowerCase()).toContain('parameterized');
    expect(prd.markdown.toLowerCase()).toContain('zod');
    expect(prd.markdown.toLowerCase()).toContain('real data only');
    expect(prd.markdown).toContain('src/i18n/en.ts');
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

  it('lists API routes, Zod schema names, and example request/response bodies', () => {
    expect(prd.markdown).toContain('GET | `/api/trips`');
    expect(prd.markdown).toContain('POST | `/api/trips`');
    expect(prd.markdown).toContain('GET | `/api/trips/:id`');
    expect(prd.markdown).toContain('TripCreateSchema');
    expect(prd.markdown).toContain('DriverCreateSchema');
    // Concrete example payloads (request AND response body)
    expect(prd.markdown).toMatch(/Request:\s*\{[^}]*"title"/);
    expect(prd.markdown).toMatch(/Response:\s*201\s*\{/);
    expect(prd.markdown).toMatch(/Errors:\s*400\s*\{ "error"/);
  });

  it('marks MVP features and orders them before Beyond MVP', () => {
    expect(prd.markdown).toContain('## 8. Core Features (MVP first)');
    expect(prd.markdown).toMatch(/### F1 — .+ \*\*\[MVP\]\*\*/);
    expect(prd.markdown).toMatch(/### F2 — .+ \*\*\[MVP\]\*\*/);
    expect(prd.markdown).toMatch(/### F3 — .+ \*\*\[MVP\]\*\*/);
    expect(prd.markdown).toMatch(/### F4 — .+ \*\*\[MVP\]\*\*/);
    const mvpHeading = prd.markdown.indexOf('### MVP');
    const beyondHeading = prd.markdown.indexOf('### Beyond MVP');
    const firstMvpFeature = prd.markdown.indexOf('**[MVP]**');
    expect(mvpHeading).toBeGreaterThan(-1);
    expect(beyondHeading).toBeGreaterThan(mvpHeading);
    expect(firstMvpFeature).toBeGreaterThan(mvpHeading);
    expect(firstMvpFeature).toBeLessThan(beyondHeading);
    // Beyond-MVP features must not carry the MVP tag
    const beyondSection = prd.markdown.slice(beyondHeading, prd.markdown.indexOf('## 9.'));
    expect(beyondSection).not.toContain('**[MVP]**');
  });

  it('renders acceptance criteria as bullet points with GIVEN/WHEN/THEN', () => {
    expect(prd.markdown).toContain('## 9. Acceptance Criteria');
    expect(prd.markdown).toContain('**Acceptance criteria**');
    const bullets = prd.markdown.match(/^- GIVEN .+ WHEN .+ THEN .+$/gm);
    expect(bullets).not.toBeNull();
    expect(bullets!.length).toBeGreaterThanOrEqual(4);
    // Old prose form must not be the only format
    expect(prd.markdown).not.toMatch(/\*\*Acceptance:\*\* GIVEN/);
  });

  it('includes a named test plan per feature (unit / integration / e2e cases)', () => {
    expect(prd.markdown).toContain('## 10. Test Plan');
    expect(prd.markdown).toContain('**Unit**');
    expect(prd.markdown).toContain('**Integration**');
    expect(prd.markdown).toContain('**E2E**');
    expect(prd.markdown).toMatch(/filterTrips_byQuery/);
  });

  it('uses vertical slices with DB/API/UI/Tests/Verify (not horizontal phases)', () => {
    expect(prd.markdown).toContain('## 11. Build Plan (vertical slices)');
    expect(prd.markdown).toContain('### Slice 0 — Walking skeleton');
    expect(prd.markdown).toMatch(/### Slice 1 —/);
    // Each slice block should carry the five tracer fields
    const sliceBlocks = prd.markdown.match(/### Slice \d+ —[\s\S]*?(?=### Slice \d+ —|## 12\.)/g);
    expect(sliceBlocks).not.toBeNull();
    expect(sliceBlocks!.length).toBeGreaterThanOrEqual(3);
    for (const block of sliceBlocks!) {
      expect(block).toMatch(/^- DB: /m);
      expect(block).toMatch(/^- API: /m);
      expect(block).toMatch(/^- UI: /m);
      expect(block).toMatch(/^- Tests: /m);
      expect(block).toMatch(/^- Verify: `/m);
    }
    // Horizontal anti-pattern labels should not be the build plan structure
    expect(prd.markdown).not.toContain('**T1** — Scaffold');
  });

  it('names exact verification gate commands and threshold 90', () => {
    expect(prd.markdown).toContain('## 12. Verification & Gates');
    expect(prd.markdown).toContain('npx tsc --noEmit');
    expect(prd.markdown).toContain('npx eslint . --max-warnings 0');
    expect(prd.markdown).toContain('npx vitest run');
    expect(prd.markdown).toContain('npm run build');
    expect(prd.markdown).toContain('curl -sf http://127.0.0.1:<port>/api/health');
    expect(prd.markdown).toContain(`npm run gate -- ${prd.slug} --threshold 90`);
    expect(prd.markdown).toMatch(/score >= \*\*90\*\*|threshold 90/);
  });

  it('includes problem statement, user stories, and success outcome', () => {
    expect(prd.markdown).toContain('## 2. Problem Statement');
    expect(prd.markdown).toContain(prd.prompt);
    expect(prd.markdown).toContain('## 6. User Stories');
    expect(prd.markdown).toMatch(/As a \*\*.+\*\*, I want/);
    expect(prd.markdown).toContain('## 4. Success Outcome');
    expect(prd.markdown).toContain('Definition of done');
  });

  it('tightens the build prompt to reference vertical slices and section numbers', () => {
    const promptSection = prd.markdown.split('## Initial build prompt')[1] ?? '';
    expect(promptSection).toContain('§11');
    expect(promptSection).toContain('§7');
    expect(promptSection).toContain('§9');
    expect(promptSection).toContain('§10');
    expect(promptSection).toContain('§13');
    expect(promptSection).toContain('§12');
    expect(promptSection).toContain('§5');
    expect(promptSection).toMatch(/Slice 0→Slice \d+/);
    expect(promptSection).toContain('F1');
  });

  it('embeds the enforced Cloudflare stack and the user entities', () => {
    expect(prd.markdown).toContain('Cloudflare');
    expect(prd.markdown).toContain('Web Crypto');
    expect(prd.markdown.toLowerCase()).toContain('trips');
  });

  it('threads wizard scope options into Architecture', () => {
    const scoped = generatePrd(
      {
        prompt: 'A marketplace for local makers with listings and search',
        appType: 'Marketplace',
        hasAuth: true,
        entities: 'Listing, Seller',
        dataStorage: 'relational',
        hasRealtime: true,
        integrations: 'Stripe, Email'
      },
      estimate({ features: 4, hasAuth: true, entities: 2, scopeSignals: 4 })
    );
    expect(scoped.markdown).toContain('Relational + search');
    expect(scoped.markdown).toMatch(/Realtime \| Yes/i);
    expect(scoped.markdown).toContain('Stripe, Email');
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
    expect(publicPrd.markdown).toMatch(/Slice 0→Slice \d+/);
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

  it('grades itself in §14 with a computed score (not hardcoded)', () => {
    expect(prd.markdown).toContain('## 14. PRD Self-Check');
    expect(prd.markdown).toMatch(/\*\*Grade: \d+\/\d+ checks passed \(\d+%\)\*\*/);
    expect(prd.markdown).toMatch(/- \[x\] Machine frontmatter present/);
    const gradeLine = prd.markdown.match(
      /\*\*Grade: (\d+)\/(\d+) checks passed \((\d+)%\)\*\*/
    );
    expect(gradeLine).not.toBeNull();
    const passed = Number(gradeLine![1]);
    const total = Number(gradeLine![2]);
    const percent = Number(gradeLine![3]);
    expect(total).toBeGreaterThan(0);
    expect(passed).toBeGreaterThan(0);
    expect(percent).toBe(Math.round((passed / total) * 100));
  });
});

describe('evaluatePrdSelfCheck', () => {
  it('drops the grade for deliberately incomplete markdown (proves score is real)', () => {
    const full = evaluatePrdSelfCheck(prd.markdown, {
      entities: ['trips', 'drivers'],
      hasDomainTables: true
    });
    expect(full.passed).toBe(full.total);
    expect(full.percent).toBe(100);

    const incomplete = evaluatePrdSelfCheck(
      '# Incomplete\n\nNo sections, no frontmatter, no features.\n',
      { entities: ['trips'], hasDomainTables: true }
    );
    expect(incomplete.passed).toBeLessThan(full.passed);
    expect(incomplete.percent).toBeLessThan(full.percent);
    expect(incomplete.percent).toBe(
      Math.round((incomplete.passed / incomplete.total) * 100)
    );
    // Spot-check that several expected failures actually failed
    const byId = Object.fromEntries(incomplete.items.map((i) => [i.id, i.pass]));
    expect(byId['frontmatter']).toBe(false);
    expect(byId['problem']).toBe(false);
    expect(byId['mvp-features']).toBe(false);
    expect(byId['sections-order']).toBe(false);
  });

  it('fails placeholder check when TBD appears outside the self-check section', () => {
    const withTbd = prd.markdown.replace(
      '## 2. Problem Statement',
      '## 2. Problem Statement\n\nTBD finish this later\n'
    );
    // Rebuild grade on mutated body (strip old self-check to avoid double section)
    const without14 = withTbd.split('## 14. PRD Self-Check')[0] + '## 14. PRD Self-Check\n';
    const result = evaluatePrdSelfCheck(without14, {
      entities: ['trips', 'drivers'],
      hasDomainTables: true
    });
    const placeholder = result.items.find((i) => i.id === 'no-placeholders');
    expect(placeholder?.pass).toBe(false);
    expect(result.passed).toBeLessThan(result.total);
  });
});

describe('generatePrd sample: dog care reminders', () => {
  const sample = generatePrd(
    {
      prompt: 'an app to remind you when your dog needs grooming, vet visits, ear cleaning',
      appType: 'Mobile app',
      hasAuth: false,
      entities: 'Reminder, Pet',
      dataStorage: 'simple',
      hasRealtime: false,
      integrations: ''
    },
    estimate({ features: 3, hasAuth: false, entities: 2, scopeSignals: 2 })
  );

  it('produces a full agentic PRD for the dog-care input', () => {
    expect(sample.slug).toMatch(/dog|grooming|remind/);
    expect(sample.title.length).toBeGreaterThan(0);
    expect(firstYamlFence(sample.markdown)).toContain('Mobile app');
    expect(sample.markdown).toContain('CREATE TABLE IF NOT EXISTS reminders');
    expect(sample.markdown).toContain('CREATE TABLE IF NOT EXISTS pets');
    expect(sample.markdown).toContain('ReminderCreateSchema');
    expect(sample.markdown).toContain('PetCreateSchema');
    expect(sample.markdown).toMatch(/^- GIVEN .+ WHEN .+ THEN .+$/m);
    expect(sample.markdown).toContain('### Slice 0 — Walking skeleton');
    expect(sample.markdown).toContain('npm run gate --');
    expect(sample.markdown).toContain('--threshold 90');
    expect(sample.markdown).toContain('## 7. Technical Requirements');
    expect(sample.markdown).toContain('### 7.3 Design specifications');
    expect(sample.markdown).toContain('## 13. Coding Standard (must)');
    expect(sample.markdown).toContain('Simple D1 tables');
    expect(sample.markdown).toContain('**[MVP]**');
    expect(sample.markdown).toContain('### Beyond MVP');
    expect(sample.markdown).toMatch(/Request:\s*\{/);
    expect(sample.markdown).toMatch(/Response:\s*201\s*\{/);
    expect(sample.markdown).toMatch(/\*\*Grade: \d+\/\d+ checks passed/);
  });
});
