const DEFAULT_BUCKET = 'product-images';
const DEFAULT_PREFIX = 'products/staged';
const DEFAULT_MAX_AGE_HOURS = 24;

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

function getConfig() {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET;
  const prefix = process.env.STAGED_PRODUCT_IMAGES_PREFIX || DEFAULT_PREFIX;
  const maxAgeHours = Number(
    process.env.STAGED_PRODUCT_IMAGES_MAX_AGE_HOURS || DEFAULT_MAX_AGE_HOURS,
  );
  const dryRun = process.env.DRY_RUN !== 'false';

  if (!supabaseUrl) {
    throw new Error('Set SUPABASE_URL or DATABASE_URL before running cleanup.');
  }
  if (!serviceRoleKey) {
    throw new Error('Set SUPABASE_SERVICE_ROLE_KEY before running cleanup.');
  }
  if (!Number.isFinite(maxAgeHours) || maxAgeHours <= 0) {
    throw new Error('STAGED_PRODUCT_IMAGES_MAX_AGE_HOURS must be a positive number.');
  }

  return {
    bucket,
    dryRun,
    maxAgeHours,
    prefix: prefix.replace(/^\/+|\/+$/g, ''),
    serviceRoleKey,
    supabaseUrl,
  };
}

async function listStorageObjects(config) {
  const response = await fetch(
    `${config.supabaseUrl}/storage/v1/object/list/${config.bucket}`,
    {
      method: 'POST',
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        limit: 1000,
        offset: 0,
        prefix: config.prefix,
        sortBy: {
          column: 'created_at',
          order: 'asc',
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Supabase list failed with ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

function getObjectTimestamp(object) {
  const value = object.created_at ?? object.updated_at ?? object.last_accessed_at;
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : null;
}

function getObjectPath(prefix, object) {
  const name = String(object.name || '').replace(/^\/+/, '');
  return name.startsWith(`${prefix}/`) ? name : `${prefix}/${name}`;
}

async function deleteStorageObjects(config, prefixes) {
  const response = await fetch(
    `${config.supabaseUrl}/storage/v1/object/${config.bucket}`,
    {
      method: 'DELETE',
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prefixes }),
    },
  );

  if (!response.ok) {
    throw new Error(`Supabase delete failed with ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

async function main() {
  const config = getConfig();
  const cutoff = Date.now() - config.maxAgeHours * 60 * 60 * 1000;
  const objects = await listStorageObjects(config);
  const stalePaths = objects
    .filter((object) => {
      const timestamp = getObjectTimestamp(object);
      return timestamp !== null && timestamp < cutoff;
    })
    .map((object) => getObjectPath(config.prefix, object));

  console.log(
    `Found ${stalePaths.length} staged product image object(s) older than ${config.maxAgeHours}h in ${config.bucket}/${config.prefix}.`,
  );

  if (stalePaths.length === 0) return;

  if (config.dryRun) {
    console.log('DRY_RUN=true, no files deleted. Set DRY_RUN=false to delete:');
    for (const path of stalePaths) console.log(`- ${path}`);
    return;
  }

  const deleted = await deleteStorageObjects(config, stalePaths);
  console.log(`Deleted ${Array.isArray(deleted) ? deleted.length : stalePaths.length} object(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
