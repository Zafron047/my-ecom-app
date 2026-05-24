import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/product-media/supabase-storage', () => ({
  assertStorageObjectsExist: vi.fn().mockResolvedValue(undefined),
  deleteProductImageFilesByObjectKeys: vi.fn(),
  deleteStorageObjectKeysBestEffort: vi.fn(),
  deleteStorageObjects: vi.fn().mockResolvedValue(undefined),
  downloadStorageObject: vi.fn().mockResolvedValue(Buffer.from('staged-image')),
  uploadStorageBuffer: vi.fn().mockResolvedValue(undefined),
  uploadStorageObject: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/product-media/image-processing', () => ({
  getContentTypeFromExtension: vi.fn(() => 'image/jpeg'),
  uploadOptimizedImageVariants: vi.fn().mockResolvedValue(undefined),
  uploadOptimizedImageVariantsFromBuffer: vi.fn().mockResolvedValue(undefined),
}));

import {
  assertStorageObjectsExist,
  uploadStorageBuffer,
  uploadStorageObject,
} from '@/lib/product-media/supabase-storage';
import {
  uploadOptimizedImageVariants,
  uploadOptimizedImageVariantsFromBuffer,
} from '@/lib/product-media/image-processing';
import { saveProductImages } from '@/lib/product-media/product-image-service';

describe('product image save flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    process.env.SUPABASE_STORAGE_BUCKET = 'product-images';
  });

  it('creates optimized variants before returning direct file uploads for DB persistence', async () => {
    const formData = new FormData();
    const file = new File([Buffer.from('new-image')], 'new-image.jpg', {
      type: 'image/jpeg',
    });

    formData.append('imageOrder', 'new:client-1');
    formData.append('productImageClientIds', 'client-1');
    formData.append('productImages', file);

    const images = await saveProductImages(formData, 'products/p1', 'product');

    expect(uploadStorageObject).toHaveBeenCalledWith(
      'products/p1/original/img1.jpg',
      file,
    );
    expect(uploadOptimizedImageVariants).toHaveBeenCalledWith(
      'products/p1/original/img1.jpg',
      file,
    );
    expect(assertStorageObjectsExist).toHaveBeenCalledWith([
      'products/p1/original/img1.jpg',
      'products/p1/thumb/img1.webp',
      'products/p1/detail/img1.webp',
      'products/p1/zoom/img1.webp',
    ]);
    expect(images).toEqual([
      {
        altText: 'new-image',
        clientId: 'client-1',
        sortOrder: 0,
        storagePath:
          'https://example.supabase.co/storage/v1/object/public/product-images/products/p1/original/img1.jpg',
      },
    ]);
  });

  it('tries the next object name when a direct file upload collides with an existing object', async () => {
    vi.mocked(uploadStorageObject)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const formData = new FormData();
    const file = new File([Buffer.from('replacement-image')], 'replacement.jpg', {
      type: 'image/jpeg',
    });

    formData.append('imageOrder', 'new:client-1');
    formData.append('productImageClientIds', 'client-1');
    formData.append('productImages', file);

    const images = await saveProductImages(formData, 'products/p1', 'product');

    expect(uploadStorageObject).toHaveBeenNthCalledWith(
      1,
      'products/p1/original/img1.jpg',
      file,
    );
    expect(uploadStorageObject).toHaveBeenNthCalledWith(
      2,
      'products/p1/original/img1-2.jpg',
      file,
    );
    expect(uploadOptimizedImageVariants).toHaveBeenCalledWith(
      'products/p1/original/img1-2.jpg',
      file,
    );
    expect(images[0]).toMatchObject({
      clientId: 'client-1',
      storagePath:
        'https://example.supabase.co/storage/v1/object/public/product-images/products/p1/original/img1-2.jpg',
    });
  });

  it('creates optimized variants before returning promoted staged uploads for DB persistence', async () => {
    const formData = new FormData();

    formData.append('imageOrder', 'new:client-2');
    formData.append('uploadedProductImageClientIds', 'client-2');
    formData.append('uploadedProductImageNames', 'staged.jpg');
    formData.append(
      'uploadedProductImageObjectKeys',
      'products/staged/123-staged.jpg',
    );

    const images = await saveProductImages(formData, 'products/p1', 'product');
    const savedPath = images[0]?.storagePath ?? '';
    const objectKey = savedPath.split('/product-images/')[1];

    expect(objectKey).toMatch(/^products\/p1\/original\/img1-[a-f0-9]{8}\.jpg$/);
    expect(uploadStorageBuffer).toHaveBeenCalledWith(
      objectKey,
      Buffer.from('staged-image'),
      'image/jpeg',
    );
    expect(uploadOptimizedImageVariantsFromBuffer).toHaveBeenCalledWith(
      objectKey,
      Buffer.from('staged-image'),
    );
    expect(assertStorageObjectsExist).toHaveBeenCalledWith([
      objectKey,
      objectKey?.replace('/original/', '/thumb/').replace(/\.jpg$/, '.webp'),
      objectKey?.replace('/original/', '/detail/').replace(/\.jpg$/, '.webp'),
      objectKey?.replace('/original/', '/zoom/').replace(/\.jpg$/, '.webp'),
    ]);
    expect(images[0]).toMatchObject({
      altText: 'staged',
      clientId: 'client-2',
      sortOrder: 0,
    });
  });
});
