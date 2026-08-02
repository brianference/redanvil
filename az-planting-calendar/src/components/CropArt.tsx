import { useState } from 'react';
import './CropArt.css';

/** Display size for plantable cards (CSS px). */
export const CROP_ART_CARD_PX = 72;
/**
 * Timeline crop rows -- larger than the old thumbnail so green leaves remain
 * distinguishable across the 45 illustrations (carry-over from gallery-first).
 */
export const CROP_ART_ROW_PX = 88;
/** Display size for crop detail hero (CSS px). */
export const CROP_ART_DETAIL_PX = 192;
/** Compact thumb for search suggestions (CSS px). */
export const CROP_ART_THUMB_PX = 40;

interface CropArtProps {
  /** Crop id, e.g. crop-tomatoes -- maps to /crops/<id>.webp */
  cropId: string;
  /** Accessible name; decorative when empty string and aria-hidden. */
  alt: string;
  /** Card (72), row (88), detail (192), or thumb (40) for combobox rows. */
  size?: 'card' | 'row' | 'detail' | 'thumb';
  /** When true, loads eagerly (above-fold rows). */
  priority?: boolean;
  className?: string;
}

/**
 * Resolve pixel size for a CropArt size token.
 *
 * @param size - Named display size.
 */
function sizeToPx(size: NonNullable<CropArtProps['size']>): number {
  if (size === 'detail') return CROP_ART_DETAIL_PX;
  if (size === 'row') return CROP_ART_ROW_PX;
  if (size === 'thumb') return CROP_ART_THUMB_PX;
  return CROP_ART_CARD_PX;
}

/**
 * Data-driven crop illustration: /crops/<cropId>.webp.
 * Fail-closed: missing or broken art removes the image (no broken icon, no empty box).
 */
export function CropArt({
  cropId,
  alt,
  size = 'card',
  priority = false,
  className = ''
}: CropArtProps) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  const px = sizeToPx(size);
  const src = `/crops/${cropId}.webp`;

  return (
    <img
      className={`crop-art crop-art--${size}${className ? ` ${className}` : ''}`}
      src={src}
      alt={alt}
      width={px}
      height={px}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed(true)}
      data-testid="crop-art"
      data-crop-id={cropId}
    />
  );
}
