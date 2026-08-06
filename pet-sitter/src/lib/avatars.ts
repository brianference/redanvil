/**
 * Avatar paths for seed sitters. Files are synthetic image_gen portraits
 * under public/avatars (see design-refs/design-options/avatars/SOURCES.md).
 */

/** Map sitter id → public avatar URL. */
const AVATAR_BY_ID: Record<string, string> = {
  'sit-leslieville-01': '/avatars/avery-chen.jpg',
  'sit-annex-02': '/avatars/jordan-patel.jpg',
  'sit-riverdale-03': '/avatars/sam-okonkwo.jpg',
  'sit-beaches-04': '/avatars/riley-ng.jpg',
  'sit-liberty-05': '/avatars/morgan-ellis.jpg',
  'sit-highpark-06': '/avatars/casey-brooks.jpg',
  'sit-distillery-07': '/avatars/taylor-kim.jpg',
  'sit-yorkville-08': '/avatars/alex-rivera.jpg'
};

/**
 * Public URL for a sitter avatar, or empty string when unknown.
 *
 * @param sitterId - Sitter primary key.
 */
export function avatarUrl(sitterId: string): string {
  return AVATAR_BY_ID[sitterId] ?? '';
}

/**
 * Initials fallback when an avatar image is missing.
 *
 * @param name - Display name.
 */
export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0] ?? '';
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? '';
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}
