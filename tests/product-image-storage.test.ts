import { describe, expect, it } from 'vitest';
import {
  getStorageObjectKeysWithVariants,
  getVariantObjectKey,
  isStagedProductImageObjectKey,
} from '@/lib/product-image-storage';
import { assertProductImageCountAllowed } from '@/lib/product-media/product-image-service';

describe('product image storage helpers', () => {
  it('builds sibling variant keys for canonical original product images', () => {
    expect(
      getStorageObjectKeysWithVariants('products/p1/original/img1.webp'),
    ).toEqual([
      'products/p1/original/img1.webp',
      'products/p1/thumb/img1.webp',
      'products/p1/detail/img1.webp',
      'products/p1/zoom/img1.webp',
    ]);
  });

  it('builds legacy suffixed variant keys when no original folder exists', () => {
    expect(getVariantObjectKey('products/p1/img1.jpg', 'thumb')).toBe(
      'products/p1/img1-thumb.webp',
    );
  });

  it('only treats the staged product folder as staged upload input', () => {
    expect(
      isStagedProductImageObjectKey('products/staged/123-image.webp'),
    ).toBe(true);
    expect(isStagedProductImageObjectKey('products/p1/original/img1.webp')).toBe(
      false,
    );
  });

  it('enforces the product image count invariant', () => {
    expect(() => assertProductImageCountAllowed(10)).not.toThrow();
    expect(() => assertProductImageCountAllowed(11)).toThrow(
      'You can upload up to 10 images per product.',
    );
  });
});
