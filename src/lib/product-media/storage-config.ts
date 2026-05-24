const DEFAULT_SUPABASE_STORAGE_BUCKET = 'product-images';

export function getSupabaseProjectUrlFromDatabaseUrl() {
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

export function getSupabaseUrl() {
  return (
    process.env.SUPABASE_URL?.replace(/\/$/, '') ??
    getSupabaseProjectUrlFromDatabaseUrl()
  );
}

export function getSupabaseStorageBucket() {
  return process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_SUPABASE_STORAGE_BUCKET;
}

export function getSupabaseStorageConfig() {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Product image storage operations require SUPABASE_SERVICE_ROLE_KEY. Set SUPABASE_URL too if it cannot be inferred from DATABASE_URL.',
    );
  }

  return {
    bucket: getSupabaseStorageBucket(),
    serviceRoleKey,
    supabaseUrl,
  };
}

export function getOptionalSupabaseStorageConfig() {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return null;

  return {
    bucket: getSupabaseStorageBucket(),
    serviceRoleKey,
    supabaseUrl,
  };
}
