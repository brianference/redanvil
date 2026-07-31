import { describe, it, expect } from 'vitest';
import { buildClaims, claimsJson, type AppClaims } from './claims';
import { chooseDesignDirection } from './sections/design';
import { PRD_THRESHOLD } from './types';

const baseFeatures = [
  {
    id: 'F1',
    name: 'Search recipes',
    behavior: 'User can find recipes by ingredient',
    acceptance: [
      'GIVEN a recipe catalogue WHEN the user searches for eggs THEN matching recipes appear'
    ],
    mvp: true
  },
  {
    id: 'F2',
    name: 'Save favourite',
    behavior: 'User can bookmark a recipe',
    acceptance: [
      'GIVEN a recipe detail WHEN the user taps save THEN it appears in favourites'
    ],
    mvp: false
  }
] as const;

const baseOpts = {
  slug: 'recipe-box',
  title: 'Recipe Box',
  prompt: 'Build a recipe box for home cooks with search',
  appType: 'content',
  hasAuth: true,
  entities: ['recipes', 'favourites'],
  features: baseFeatures
};

describe('buildClaims', () => {
  it('copies identity fields and embeds the PRD gate threshold', () => {
    const claims = buildClaims(baseOpts);

    expect(claims.kind).toBe('claims');
    expect(claims.slug).toBe('recipe-box');
    expect(claims.title).toBe('Recipe Box');
    expect(claims.appType).toBe('content');
    expect(claims.hasAuth).toBe(true);
    expect(claims.entities).toEqual(['recipes', 'favourites']);
    expect(claims.threshold).toBe(PRD_THRESHOLD);
    expect(claims.threshold).toBe(90);
  });

  it('uses the same design seed as the PRD so claims match the written spec', () => {
    const claims = buildClaims(baseOpts);
    const expectedSeed = `${baseOpts.prompt}|${baseOpts.appType}|${baseOpts.entities}`;
    const direction = chooseDesignDirection(expectedSeed);

    expect(claims.design.archetype).toBe(direction.archetype.name);
    expect(claims.design.structure).toBe(direction.archetype.structure);
    expect(claims.design.visual).toBe(direction.visual.name);
    expect(claims.design.rejected).toEqual([...direction.rejected]);
    expect(claims.design.rejected).not.toContain(claims.design.archetype);
  });

  it('maps features into claim records with copied acceptance arrays', () => {
    const claims = buildClaims(baseOpts);

    expect(claims.features).toHaveLength(2);
    expect(claims.features[0]).toEqual({
      id: 'F1',
      name: 'Search recipes',
      behavior: 'User can find recipes by ingredient',
      acceptance: [
        'GIVEN a recipe catalogue WHEN the user searches for eggs THEN matching recipes appear'
      ],
      mvp: true
    });
    expect(claims.features[1]?.mvp).toBe(false);
    // Defensive copy: mutating the input must not rewrite the claims object.
    const mutable = {
      ...baseOpts,
      features: [
        {
          id: 'F1',
          name: 'Search recipes',
          behavior: 'User can find recipes by ingredient',
          acceptance: ['original'],
          mvp: true
        }
      ]
    };
    const frozen = buildClaims(mutable);
    mutable.features[0]!.acceptance.push('mutated');
    expect(frozen.features[0]?.acceptance).toEqual(['original']);
  });

  it('omits coldVisitorProbe when the author did not supply one', () => {
    const claims = buildClaims(baseOpts);
    expect(claims).not.toHaveProperty('coldVisitorProbe');
  });

  it('includes coldVisitorProbe when provided so cold-start checks can run', () => {
    const probe = {
      control: 'Search',
      fill: { 'Search recipes': 'eggs' },
      expectSelector: '[data-testid="recipe-list"] li',
      minCount: 1
    };
    const claims = buildClaims({ ...baseOpts, coldVisitorProbe: probe });
    expect(claims.coldVisitorProbe).toEqual(probe);
  });

  it('defensively copies entities so later mutation of the input does not rewrite claims', () => {
    const entities = ['recipes'];
    const claims = buildClaims({ ...baseOpts, entities });
    entities.push('leaked');
    expect(claims.entities).toEqual(['recipes']);
  });
});

describe('claimsJson', () => {
  it('serialises claims as pretty JSON with a trailing newline', () => {
    const claims = buildClaims(baseOpts);
    const json = claimsJson(claims);

    expect(json.endsWith('\n')).toBe(true);
    expect(json).toBe(JSON.stringify(claims, null, 2) + '\n');

    const parsed = JSON.parse(json) as AppClaims;
    expect(parsed.kind).toBe('claims');
    expect(parsed.slug).toBe(claims.slug);
    expect(parsed.features).toHaveLength(claims.features.length);
    expect(parsed.design.archetype).toBe(claims.design.archetype);
  });
});
