import { avatarUrl, initialsFromName } from '../lib/avatars';

export interface SitterAvatarProps {
  /** Sitter id for avatar lookup. */
  sitterId: string;
  /** Display name for alt text and initials. */
  name: string;
  /** Optional CSS class. */
  className?: string;
}

/**
 * Sitter face: synthetic avatar when mapped, initials otherwise.
 *
 * @param props - Identity fields.
 */
export function SitterAvatar({ sitterId, name, className }: SitterAvatarProps): JSX.Element {
  const src = avatarUrl(sitterId);
  const cls = className ?? 'sitter-avatar';
  if (src) {
    return <img className={cls} src={src} alt="" width={120} height={120} loading="lazy" />;
  }
  return (
    <span className={`${cls} sitter-avatar--fallback`} aria-hidden="true">
      {initialsFromName(name)}
    </span>
  );
}
