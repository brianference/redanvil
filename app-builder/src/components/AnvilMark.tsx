/**
 * Props for the blacksmith anvil logo mark.
 */
export interface AnvilMarkProps {
  /** Rendered width and height in CSS pixels. @default 20 */
  size?: number;
  /** Accessible name exposed via SVG `<title>`. @default "Anvil" */
  title?: string;
}

/**
 * Clean minimal blacksmith-anvil silhouette as an inline SVG.
 * Face on top, left-pointing horn, stepped waist, wide trapezoidal base.
 * Fill uses `currentColor` so the parent controls color.
 */
export function AnvilMark({ size = 20, title = 'Anvil' }: AnvilMarkProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      {/*
        Classic side-view anvil: pointed horn (left), flat face, small heel,
        narrow waist/step, wide base. Solid silhouette for 20–32px marks.
      */}
      <path d="M1.2 10.2 L7.8 6.4 H18.2 V8.6 H21.2 V11 H16.2 L15.2 13.2 H13.6 V16.2 H19.6 L21.6 21.4 H2.4 L4.4 16.2 H10.4 V13.2 H8.8 L7.8 11 H3.6 Z" />
    </svg>
  );
}
