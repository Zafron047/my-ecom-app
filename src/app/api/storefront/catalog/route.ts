import { NextResponse } from 'next/server';
import { getStorefrontCatalog } from '@/lib/storefront-data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const catalog = await getStorefrontCatalog();
    return NextResponse.json(catalog);
  } catch {
    return NextResponse.json(
      { error: 'Failed to load storefront catalog.' },
      { status: 500 },
    );
  }
}
