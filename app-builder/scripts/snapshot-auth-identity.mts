/**
 * Snapshot of generatePrd output for the overnight prompt (before/after report).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generatePrd } from '../src/lib/prd/generate.ts';
import { deriveEntities } from '../src/lib/prd/naming.ts';
import {
  authRequiredByFeatures,
  buildFeatures,
  defaultSelectedFeatureIds
} from '../src/lib/prd/sections/features.ts';
import { detectCapabilities, extractSubject } from '../src/lib/prd/sections/capabilities.ts';
import { estimate } from '../src/lib/estimate.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const prompt = readFileSync(
  join(repoRoot, '.redanvil', 'overnight', 'concept-job-application-site.txt'),
  'utf8'
);
const entities = deriveEntities(prompt);
console.log('AFTER entities', JSON.stringify(entities));
console.log('AFTER subject', JSON.stringify(extractSubject(prompt, entities)));
console.log(
  'AFTER caps',
  detectCapabilities(prompt, entities).map((c) => `${c.kind}:${c.subject}`)
);
const features = buildFeatures(entities, true, prompt);
console.log('AFTER feature names');
for (const f of features) console.log(' ', f.id, f.role, f.name);
const accounts = features.find((f) => f.role === 'accounts');
console.log('AFTER accounts id', accounts?.id, accounts?.name);
console.log('AFTER authRequired all', authRequiredByFeatures(true, features));
const selected = defaultSelectedFeatureIds(entities, true, prompt);
console.log('AFTER selected', selected.join(','));
const cost = estimate({ features: 8, hasAuth: true, entities: entities.length });
const prd = generatePrd(
  { prompt, appType: 'SaaS', hasAuth: true, entities: '', selectedFeatureIds: selected },
  cost
);
const yaml = prd.markdown.match(/```yaml\n([\s\S]*?)\n```/)?.[1] ?? '';
console.log('AFTER yaml');
console.log(yaml);
console.log('AFTER fully public', prd.markdown.includes('fully public'));
console.log('AFTER hasAuth true in yaml', /hasAuth: true/.test(yaml ?? ''));
console.log('AFTER hasAuth false in yaml', /hasAuth: false/.test(yaml ?? ''));
const headings = [...prd.markdown.matchAll(/^### (F\d+ — .+)$/gm)].map((m) => m[1]);
console.log('AFTER headings (first 20)');
for (const h of headings.slice(0, 20)) console.log(' ', h);
