import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { uploadStorageObject } from '@/lib/product-media/supabase-storage';

describe('product image Supabase storage uploads', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    process.env.SUPABASE_STORAGE_BUCKET = 'product-images';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns false when Supabase reports a duplicate object in the response body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            statusCode: '409',
            error: 'Duplicate',
            message: 'The resource already exists',
          }),
          { status: 400 },
        ),
      ),
    );

    const result = await uploadStorageObject(
      'products/p1/original/img1.jpg',
      new File([Buffer.from('new-image')], 'new-image.jpg', {
        type: 'image/jpeg',
      }),
    );

    expect(result).toBe(false);
  });

  it('throws the upload response text for non-duplicate failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('storage offline', { status: 503 })),
    );

    await expect(
      uploadStorageObject(
        'products/p1/original/img1.jpg',
        new File([Buffer.from('new-image')], 'new-image.jpg', {
          type: 'image/jpeg',
        }),
      ),
    ).rejects.toThrow('Failed to upload product image: storage offline');
  });
});
