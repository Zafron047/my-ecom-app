import { NextResponse } from 'next/server';
import { getStorefrontProductDetailById } from '@/lib/storefront-data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const product = await getStorefrontProductDetailById(id);

    if (!product) {
      return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch {
    return NextResponse.json(
      { error: 'Failed to load product details.' },
      { status: 500 },
    );
  }
}
