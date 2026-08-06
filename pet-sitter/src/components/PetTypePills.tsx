export interface PetTypePillsProps {
  /** Comma-separated pet_types from the sitter row. */
  petTypes: string;
  /** Optional extra class on the wrapper. */
  className?: string;
}

/**
 * Pet-type pills from the real pet_types column (never invented).
 *
 * @param props - Raw pet_types string.
 */
export function PetTypePills({ petTypes, className }: PetTypePillsProps): JSX.Element {
  const parts = petTypes
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1));

  return (
    <div className={className ? `pills ${className}` : 'pills'}>
      {parts.map((p) => (
        <span key={p} className="pill">
          {p}
        </span>
      ))}
    </div>
  );
}
