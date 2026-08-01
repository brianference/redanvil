import { PRD_THRESHOLD } from '../types';
import { yamlString } from '../naming';

/**
 * Build the machine-readable YAML frontmatter fence.
 */
export function buildFrontmatter(opts: {
  slug: string;
  title: string;
  appType: string;
  hasAuth: boolean;
  entities: string[];
}): string {
  const entityYaml =
    opts.entities.length > 0
      ? `[${opts.entities.map((e) => yamlString(e)).join(', ')}]`
      : '[]';
  return [
    '```yaml',
    `appType: ${yamlString(opts.appType)}`,
    `hasAuth: ${opts.hasAuth}`,
    `entities: ${entityYaml}`,
    'targetType: fullstack-web',
    `threshold: ${PRD_THRESHOLD}`,
    `slug: ${yamlString(opts.slug)}`,
    `title: ${yamlString(opts.title)}`,
    '```'
  ].join('\n');
}
