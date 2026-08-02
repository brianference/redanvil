import { useState } from 'react';
import './CropArt.css';

/** Display size for plantable cards and grid rows (CSS px). */
export const CROP_ART_CARD_PX = 72;
/** Display size for crop detail hero (CSS px). */
export const CROP_ART_DETAIL_PX = 192;

interface CropArtProps {
  /** Crop id, e.g. crop-tomatoes -- maps to /crops/<id>.webp */
  cropId: string;
  /** Accessible name; decorative when empty string and aria-hidden. */
  alt: string;
  /** Card (72) or detail (192). */
  size?: 'card' | 'detail';
  /** When true, loads eagerly (above-fold hero cards). */
  priority?: boolean;
  className?: string;
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

  const px = size === 'detail' ? CROP_ART_DETAIL_PX : CROP_ART_CARD_PX;
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
