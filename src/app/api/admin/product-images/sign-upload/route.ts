import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin-session';

const SUPABASE_STORAGE_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET || 'product-images';

function getSupabaseProjectUrlFromDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return undefined;

  try {
    const parsedUrl = new URL(databaseUrl);
    const usernameProjectRef = decodeURIComponent(parsedUrl.username).match(
      /^postgres\.([a-z0-9]+)$/i,
    )?.[1];
    const hostProjectRef = parsedUrl.hostname.match(
      /^(?:db|pooler)\.([a-z0-9]+)\.supabase\.co$/i,
    )?.[1];
    const projectRef = usernameProjectRef ?? hostProjectRef;

    return projectRef ? `https://${projectRef}.supabase.co` : undefined;
  } catch {
    return undefined;
  }
}

function getSupabaseUrl() {
  return (
    process.env.SUPABASE_URL?.replace(/\/$/, '') ??
    getSupabaseProjectUrlFromDatabaseUrl()
  );
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Supabase storage is not configured.' },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | { contentType?: string; extension?: string }
    | null;
  const extension = (body?.extension || '.jpg').toLowerCase();
  const sanitizedExtension = extension.match(/^\.[a-z0-9]+$/i)?.[0] ?? '.jpg';
  const contentType = body?.contentType || 'application/octet-stream';
  const objectKey = `products/staged/${Date.now()}-${crypto.randomUUID()}${sanitizedExtension}`;

  const signResponse = await fetch(
    `${supabaseUrl}/storage/v1/object/upload/sign/${SUPABASE_STORAGE_BUCKET}/${encodeURIComponent(
      objectKey,
    ).replace(/%2F/g, '/')}`,
    {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ upsert: false }),
    },
  );

  if (!signResponse.ok) {
    return NextResponse.json(
      { error: `Failed to sign upload: ${await signResponse.text()}` },
      { status: 500 },
    );
  }

  const signPayload = (await signResponse.json()) as {
    path?: string;
    signedURL?: string;
    token?: string;
  };
  const signedPath = signPayload.signedURL;
  const token = signPayload.token;
  const uploadPath =
    signedPath ||
    `/storage/v1/object/upload/sign/${SUPABASE_STORAGE_BUCKET}/${objectKey}?token=${encodeURIComponent(
      token || '',
    )}`;

  const uploadUrl = uploadPath.startsWith('http')
    ? uploadPath
    : `${supabaseUrl}${uploadPath}`;

  return NextResponse.json({
    bucket: SUPABASE_STORAGE_BUCKET,
    contentType,
    objectKey,
    uploadUrl,
  });
}

