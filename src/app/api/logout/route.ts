import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const CUSTOMER_SESSION_COOKIE = 'customer_id';
const CUSTOMER_AUTH_COOKIE = 'customer_auth';

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(CUSTOMER_SESSION_COOKIE);
  cookieStore.delete(CUSTOMER_AUTH_COOKIE);

  return NextResponse.json({ success: true });
}
