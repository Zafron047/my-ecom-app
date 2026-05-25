import {
  encodeStorageObjectKey,
  getStorageObjectKeysWithVariants,
} from './storage-keys';
import {
  getOptionalSupabaseStorageConfig,
  getSupabaseStorageConfig,
} from './storage-config';

function isDuplicateStorageResponse(response: Response, responseText: string) {
  if (response.status === 409) return true;

  try {
    const payload = JSON.parse(responseText) as {
      error?: unknown;
      message?: unknown;
      statusCode?: unknown;
    };

    return (
      String(payload.statusCode) === '409' ||
      String(payload.error).toLowerCase() === 'duplicate' ||
      String(payload.message).toLowerCase().includes('already exists')
    );
  } catch {
    return responseText.toLowerCase().includes('already exists');
  }
}

export async function uploadStorageObject(objectKey: string, file: File) {
  const { bucket, serviceRoleKey, supabaseUrl } = getSupabaseStorageConfig();
  const fileBytes = new Uint8Array(await file.arrayBuffer());
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${bucket}/${encodeStorageObjectKey(
      objectKey,
    )}`,
    {
      body: fileBytes,
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Cache-Control': '31536000',
        'Content-Type': file.type || 'application/octet-stream',
        'x-upsert': 'false',
      },
      method: 'POST',
    },
  );

  if (!response.ok) {
    const responseText = await response.text();
    if (isDuplicateStorageResponse(response, responseText)) return false;

    throw new Error(`Failed to upload product image: ${responseText}`);
  }

  return true;
}

export async function uploadStorageBuffer(
  objectKey: string,
  bytes: Buffer,
  contentType: string,
) {
  const { bucket, serviceRoleKey, supabaseUrl } = getSupabaseStorageConfig();
  const bodyBytes = new Uint8Array(bytes);
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${bucket}/${encodeStorageObjectKey(
      objectKey,
    )}`,
    {
      body: bodyBytes,
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Cache-Control': '31536000',
        'Content-Type': contentType,
        'x-upsert': 'true',
      },
      method: 'POST',
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to upload optimized product image: ${await response.text()}`,
    );
  }
}

export async function downloadStorageObject(objectKey: string) {
  const { bucket, serviceRoleKey, supabaseUrl } = getSupabaseStorageConfig();
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${bucket}/${encodeStorageObjectKey(objectKey)}`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      method: 'GET',
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to read uploaded image: ${await response.text()}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

export async function assertStorageObjectExists(objectKey: string) {
  const { bucket, serviceRoleKey, supabaseUrl } = getSupabaseStorageConfig();
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${bucket}/${encodeStorageObjectKey(objectKey)}`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      method: 'HEAD',
    },
  );

  if (!response.ok) {
    throw new Error(
      `Product image upload verification failed for ${objectKey}: ${response.status}`,
    );
  }
}

export async function assertStorageObjectsExist(objectKeys: string[]) {
  await Promise.all(
    objectKeys.map((objectKey) => assertStorageObjectExists(objectKey)),
  );
}

export async function deleteStorageObjects(objectKeys: string[]) {
  if (objectKeys.length === 0) return;

  const { bucket, serviceRoleKey, supabaseUrl } = getSupabaseStorageConfig();
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}`, {
    body: JSON.stringify({
      prefixes: objectKeys,
    }),
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`Failed to delete product image: ${await response.text()}`);
  }
}

export async function deleteStorageObjectKeysBestEffort(
  objectKeys: string[],
  context: string,
) {
  if (objectKeys.length === 0) return;

  try {
    await deleteStorageObjects(
      objectKeys.flatMap((objectKey) =>
        getStorageObjectKeysWithVariants(objectKey),
      ),
    );
  } catch (error) {
    console.error(context, error);
  }
}

export async function deleteProductImageFilesByObjectKeys(objectKeys: string[]) {
  if (objectKeys.length === 0) return;

  if (!getOptionalSupabaseStorageConfig()) {
    throw new Error(
      'Product image storage deletion requires SUPABASE_SERVICE_ROLE_KEY. Set SUPABASE_URL too if it cannot be inferred from DATABASE_URL.',
    );
  }

  const maxAttempts = 4;
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await deleteStorageObjects(objectKeys);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 300));
      }
    }
  }

  throw new Error(
    `Failed to delete product image(s) from storage after ${maxAttempts} attempts.${lastError instanceof Error ? ` ${lastError.message}` : ''}`,
  );
}
