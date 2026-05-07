export type ImageVariantSize = 'thumb' | 'detail' | 'zoom';

export function toVariantImageUrl(
  imageUrl: string,
  size: ImageVariantSize,
) {
  if (!imageUrl) return imageUrl;

  const suffixPattern = /-(thumb|detail|zoom)\.webp$/i;
  const folderPattern = /\/(original|thumb|detail|zoom)\//i;

  try {
    const parsed = new URL(imageUrl);
    const pathname = parsed.pathname;
    const lowerPathname = pathname.toLowerCase();
    let nextPathname = pathname;

    if (folderPattern.test(pathname)) {
      nextPathname = pathname
        .replace(folderPattern, `/${size}/`)
        .replace(/\.[^./]+$/i, '.webp');
    } else if (suffixPattern.test(pathname)) {
      nextPathname = pathname.replace(suffixPattern, `-${size}.webp`);
    } else if (lowerPathname.endsWith('.webp')) {
      // For already-webp sources without a known suffix, keep original path.
      // This avoids broken URLs when legacy images do not have generated variants.
      nextPathname = pathname;
    } else {
      const extensionMatch = pathname.match(/\.[^./]+$/);
      if (!extensionMatch) return imageUrl;
      const extension = extensionMatch[0];
      nextPathname = pathname.replace(
        new RegExp(`${extension.replace('.', '\\.')}$`),
        `-${size}.webp`,
      );
    }

    parsed.pathname = nextPathname;
    return parsed.toString();
  } catch {
    if (folderPattern.test(imageUrl)) {
      return imageUrl
        .replace(folderPattern, `/${size}/`)
        .replace(/\.[^./]+$/i, '.webp');
    }
    if (suffixPattern.test(imageUrl)) {
      return imageUrl.replace(suffixPattern, `-${size}.webp`);
    }
    if (imageUrl.toLowerCase().endsWith('.webp')) {
      return imageUrl;
    }
    const extensionMatch = imageUrl.match(/\.[^./]+$/);
    if (!extensionMatch) return imageUrl;
    return imageUrl.replace(
      new RegExp(`${extensionMatch[0].replace('.', '\\.')}$`),
      `-${size}.webp`,
    );
  }
}
