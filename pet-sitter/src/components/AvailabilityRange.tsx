import { en } from '../i18n/en';

export interface AvailabilityRangeProps {
  /** Inclusive ISO start date, or null/empty when unknown. */
  availableFrom: string | null | undefined;
  /** Inclusive ISO end date, or null/empty when unknown. */
  availableTo: string | null | undefined;
  /** Optional extra class names on the wrapper. */
  className?: string;
  /**
   * When true, prefix with the localised "Availability" label.
   * Default false — list rows usually show bare dates.
   */
  withLabel?: boolean;
  /** Element tag. Default `p`. */
  as?: 'p' | 'span';
}

/**
 * Renders `from → to` when both availability bounds exist; otherwise null.
 *
 * @param props - ISO availability bounds from a sitter row.
 */
export function AvailabilityRange({
  availableFrom,
  availableTo,
  className,
  withLabel = false,
  as = 'p'
}: AvailabilityRangeProps): JSX.Element | null {
  if (!availableFrom || !availableTo) return null;
  const Tag = as;
  const range = `${availableFrom} → ${availableTo}`;
  return (
    <Tag className={className}>
      {withLabel ? (
        <>
          {en.detail.availability}: {range}
        </>
      ) : (
        range
      )}
    </Tag>
  );
}
