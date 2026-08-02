import { Link } from 'react-router-dom';
import { en } from '../i18n/en';

export interface BrandLogoProps {
  /** Wrapper class for the home link. */
  className: string;
  /** Class for the mark image. */
  markClassName: string;
  /** Class for the wordmark. */
  nameClassName: string;
  /** Optional data-measure on the mark (home compact header). */
  markMeasure?: string;
}

/**
 * Home brand link: mark + app name. Shared by CompactHeader and Layout.
 *
 * @param props - Style class names for the two chrome variants.
 */
export function BrandLogo({
  className,
  markClassName,
  nameClassName,
  markMeasure
}: BrandLogoProps) {
  return (
    <Link to="/" className={className} aria-label={en.appName}>
      <img
        className={markClassName}
        src="/brand-mark.png"
        alt=""
        width={96}
        height={96}
        aria-hidden="true"
        decoding="async"
        {...(markMeasure !== undefined ? { 'data-measure': markMeasure } : {})}
      />
      <span className={nameClassName}>{en.appName}</span>
    </Link>
  );
}
