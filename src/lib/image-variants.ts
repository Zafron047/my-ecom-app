export type ImageVariantSize = 'thumb' | 'detail' | 'zoom';

export function toVariantImageUrl(
  imageUrl: string,
  size: ImageVariantSize,
) {
  if (!imageUrl) return imageUrl;

  try {
    const parsed = new URL(imageUrl);
    const pathname = parsed.pathname;
    const extensionMatch = pathname.match(/\.[^./]+$/);
    if (!extensionMatch) return imageUrl;

    const extension = extensionMatch[0];
    const nextPathname = pathname.replace(
      new RegExp(`${extension.replace('.', '\\.')}$`),
      `-${size}.webp`,
    );

    parsed.pathname = nextPathname;
    return parsed.toString();
  } catch {
    const extensionMatch = imageUrl.match(/\.[^./]+$/);
    if (!extensionMatch) return imageUrl;
    return imageUrl.replace(
      new RegExp(`${extensionMatch[0].replace('.', '\\.')}$`),
      `-${size}.webp`,
    );
  }
}
