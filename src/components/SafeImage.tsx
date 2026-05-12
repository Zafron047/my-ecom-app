'use client';

import { useState } from 'react';

type SafeImageProps = {
  alt: string;
  className?: string;
  fallbackClassName?: string;
  fallbackText?: string;
  src?: string | null;
};

export default function SafeImage({
  alt,
  className,
  fallbackClassName,
  fallbackText = 'Image unavailable',
  src,
}: SafeImageProps) {
  const [hasError, setHasError] = useState(false);
  const imageSrc = typeof src === 'string' && src.trim() ? src : '';
  const canShowImage = Boolean(imageSrc && !hasError);

  if (!canShowImage) {
    return (
      <div
        className={
          fallbackClassName ??
          'flex h-full w-full items-center justify-center bg-slate-100 px-1 text-center text-[10px] font-medium leading-tight text-slate-400'
        }
      >
        {fallbackText}
      </div>
    );
  }

  return (
    // Product media can be remote or local storage URLs, so this fallback keeps deleted media graceful without extra image config.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      onError={() => setHasError(true)}
    />
  );
}
