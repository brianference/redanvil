import { PRD_THRESHOLD } from '../types';
import { yamlString } from '../naming';

/** Prompt-fidelity result written into the frontmatter. */
export type FidelityStatus = 'pass' | 'fail';

/**
 * Strip one pair of matching quotes from a YAML scalar.
 *
 * @param value - Raw scalar, possibly quoted.
 * @returns The scalar text.
 */
function unquoteYaml(value: string): string {
  const trimmed = value.trim();
  const quoted = /^(['"])(.*)\1$/.exec(trimmed);
  if (quoted === null) return trimmed;
  if (quoted[1] === '"') {
    return (quoted[2] ?? '').replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return quoted[2] ?? '';
}

/**
 * Pull one YAML string list. Supports a flow list `[a, b]` and a block list.
 *
 * @param block - Frontmatter body, without the fence.
 * @param key - Field name.
 * @returns List items, or empty when the key is absent.
 */
function yamlStringList(block: string, key: string): string[] {
  const flow = new RegExp(`^${key}\\s*:\\s*\\[([^\\]]*)\\]\\s*$`, 'm').exec(block);
  if (flow) {
    return (flow[1] ?? '')
      .split(',')
      .map((item) => unquoteYaml(item))
      .filter((item) => item.length > 0);
  }
  const head = new RegExp(`^${key}\\s*:\\s*$`, 'm').exec(block);
  if (head === null) return [];
  const items: string[] = [];
  const after = block.slice(head.index + head[0].length);
  for (const line of after.split(/\r?\n/)) {
    if (line.trim().length === 0) continue;
    const item = /^\s*-\s+(.*)$/.exec(line);
    if (item === null) break;
    const value = unquoteYaml(item[1] ?? '');
    if (value.length > 0) items.push(value);
  }
  return items;
}

/**
 * Build the machine-readable YAML frontmatter fence.
 *
 * `fidelity` is `pass` or `fail`. On failure, `fidelityUnmatched` is a YAML
 * list of the requirement lines that did not appear in the features.
 *
 * @param opts - Identity fields plus the fidelity result.
 * @returns A fenced yaml block.
 */
export function buildFrontmatter(opts: {
  slug: string;
  title: string;
  appType: string;
  hasAuth: boolean;
  entities: string[];
  fidelity: FidelityStatus;
  fidelityUnmatched?: readonly string[];
}): string {
  const entityYaml =
    opts.entities.length > 0
      ? `[${opts.entities.map((e) => yamlString(e)).join(', ')}]`
      : '[]';
  const lines = [
    '```yaml',
    `appType: ${yamlString(opts.appType)}`,
    `hasAuth: ${opts.hasAuth}`,
    `entities: ${entityYaml}`,
    'targetType: fullstack-web',
    `threshold: ${PRD_THRESHOLD}`,
    `slug: ${yamlString(opts.slug)}`,
    `title: ${yamlString(opts.title)}`,
    `fidelity: ${opts.fidelity}`
  ];
  if (opts.fidelity === 'fail') {
    const unmatched = opts.fidelityUnmatched ?? [];
    lines.push('fidelityUnmatched:');
    for (const item of unmatched) {
      lines.push(`  - ${yamlString(item)}`);
    }
  }
  lines.push('```');
  return lines.join('\n');
}

/**
 * Read `fidelity` from the first yaml fence in a PRD.
 *
 * No key means the document predates the check. Only `fail` should raise the
 * warning panel; a pass or a missing key does not.
 *
 * @param markdown - Full PRD markdown.
 * @returns The status and, on failure, the unmatched requirement strings.
 */
export function readPrdFidelity(markdown: string): {
  fidelity: FidelityStatus | 'absent';
  unmatched: string[];
} {
  const fence = /```yaml\n([\s\S]*?)\n```/.exec(markdown);
  if (fence === null) return { fidelity: 'absent', unmatched: [] };
  const block = fence[1] ?? '';
  const line = /^fidelity:\s*(.*?)\s*$/m.exec(block);
  if (line === null) return { fidelity: 'absent', unmatched: [] };
  const raw = unquoteYaml(line[1] ?? '');
  if (raw === 'pass') return { fidelity: 'pass', unmatched: [] };
  if (raw !== 'fail') return { fidelity: 'absent', unmatched: [] };
  return { fidelity: 'fail', unmatched: yamlStringList(block, 'fidelityUnmatched') };
}
