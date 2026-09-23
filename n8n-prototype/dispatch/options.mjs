/**
 * Option files for a gate: images and gallery.html under that step's
 * design-refs folder. Paths are repo-relative, which is what the registry
 * contract stores.
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

/** Image extensions the gallery can embed. Matches the design-refs gitignore. */
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

/**
 * Design-refs folders a gate offers the owner.
 * decide has no folder of its own; it is the pick across the three axes.
 * @type {Record<string, string[]>}
 */
export const STEP_OPTION_DIRS = {
  logo: ['design-refs/logos'],
  palette: ['design-refs/palettes'],
  layout: ['design-refs/design-options'],
  decide: ['design-refs/logos', 'design-refs/palettes', 'design-refs/design-options']
};

/**
 * Whether `target` is `root` or a path inside it. Rejects `..` escapes.
 * @param {string} root directory that must contain the target
 * @param {string} target candidate path
 * @returns {boolean}
 */
export function isInside(root, target) {
  const base = resolve(root);
  const full = resolve(target);
  return full === base || full.startsWith(base + sep);
}

/**
 * Repo-relative path with forward slashes, the form the contract stores.
 * @param {string} repoRoot repository root
 * @param {string} filePath absolute file path
 * @returns {string}
 */
export function repoRelative(repoRoot, filePath) {
  return relative(resolve(repoRoot), resolve(filePath)).split(sep).join('/');
}

/**
 * List option files for one step. Images and gallery.html only, top level
 * of each design-refs folder. Missing folders yield no options.
 * @param {string} repoRoot repository root
 * @param {string} slug app directory name
 * @param {string} step process-map step id
 * @returns {{ label: string, path: string }[]}
 */
export function optionsForStep(repoRoot, slug, step) {
  const dirs = STEP_OPTION_DIRS[step] ?? [];
  /** @type {{ label: string, path: string }[]} */
  const options = [];
  for (const relDir of dirs) {
    const absDir = join(repoRoot, slug, relDir);
    if (!isInside(join(repoRoot, slug), absDir)) continue;
    let entries;
    try {
      entries = readdirSync(absDir, { withFileTypes: true });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        continue;
      }
      throw error;
    }
    const folder = relDir.split('/').pop() ?? relDir;
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const lower = entry.name.toLowerCase();
      const ext = lower.includes('.') ? lower.slice(lower.lastIndexOf('.')) : '';
      const isGallery = lower === 'gallery.html';
      const isImage = IMAGE_EXTENSIONS.has(ext);
      if (!isGallery && !isImage) continue;
      const abs = join(absDir, entry.name);
      if (!isInside(absDir, abs)) continue;
      const stem = entry.name.replace(/\.[^.]+$/, '');
      options.push({
        label: `${folder}/${stem}`,
        path: repoRelative(repoRoot, abs)
      });
    }
  }
  options.sort((a, b) => a.label.localeCompare(b.label));
  return options;
}

/**
 * Byte size of a file, or null when it cannot be stated.
 * @param {string} filePath absolute path
 * @returns {number | null}
 */
export function fileSize(filePath) {
  try {
    return statSync(filePath).size;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}
