/**
 * Markdown renderers for the feature-driven PRD sections (§8, §9, §10).
 */
import type { FeatureSpec } from '../types';

/**
 * Render §8 Core Features with MVP first, then Beyond MVP.
 *
 * @param features - Features to render (already filtered by selection when applicable).
 * @returns Markdown for the Core Features section body.
 */
export function renderCoreFeatures(features: FeatureSpec[]): string {
  const mvp = features.filter((f) => f.mvp);
  const rest = features.filter((f) => !f.mvp);
  const renderOne = (f: FeatureSpec): string => {
    const tag = f.mvp ? ' **[MVP]**' : '';
    return `### ${f.id} — ${f.name}${tag}\n\n${f.behavior}`;
  };
  const lines: string[] = [
    'MVP features are the **minimum** set that solves the stated problem. An agent must be able to ship only the MVP set and have a working product. Build MVP first; Beyond MVP only after MVP acceptance is green.',
    '',
    '### MVP',
    '',
    mvp.map(renderOne).join('\n\n')
  ];
  if (rest.length > 0) {
    lines.push('', '### Beyond MVP', '', rest.map(renderOne).join('\n\n'));
  }
  return lines.join('\n');
}

/**
 * Render §9 Acceptance Criteria as bullet lists per feature.
 *
 * @param features - Features to render (already filtered by selection when applicable).
 * @returns Markdown for the Acceptance Criteria section body.
 */
export function renderAcceptanceCriteria(features: FeatureSpec[]): string {
  return features
    .map((f) => {
      const bullets = f.acceptance.map((line) => `- ${line}`).join('\n');
      return `### ${f.id} — ${f.name}\n\n**Acceptance criteria**\n${bullets}`;
    })
    .join('\n\n');
}

/**
 * Render §10 Test Plan with named cases per feature.
 *
 * @param features - Features to render (already filtered by selection when applicable).
 * @returns Markdown for the Test Plan section body.
 */
export function renderTestPlan(features: FeatureSpec[]): string {
  return features
    .map((f) => {
      const unit = f.tests.unit.map((c) => `- \`${c}\``).join('\n');
      const integration = f.tests.integration.map((c) => `- \`${c}\``).join('\n');
      const e2e = f.tests.e2e.map((c) => `- \`${c}\``).join('\n');
      return [
        `### ${f.id} — ${f.name}`,
        '',
        '**Unit**',
        unit,
        '',
        '**Integration**',
        integration,
        '',
        '**E2E**',
        e2e
      ].join('\n');
    })
    .join('\n\n');
}
