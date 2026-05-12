'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import path from 'path';
import { requireAdminPermission } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';

const CATEGORY_STORAGE_FOLDER = 'categories';
const SUPABASE_STORAGE_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET || 'product-images';
const MAX_CATEGORY_IMAGE_UPLOAD_ATTEMPTS = 100;

export type CategoryFormState = {
  archivedAt?: number;
  archivedCategoryId?: string;
  deletedAt?: number;
  deletedCategoryId?: string;
  error: string | null;
  savedAt?: number;
  savedSnapshot?: string;
  success?: string | null;
};

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

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function getOptionalString(formData: FormData, key: string) {
  const value = getString(formData, key);
  return value.length > 0 ? value : null;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function getBoolean(formData: FormData, key: string) {
  return formData.get(key) === 'on';
}

function getSupabaseStorageConfig() {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Category image uploads require SUPABASE_SERVICE_ROLE_KEY. Set SUPABASE_URL too if it cannot be inferred from DATABASE_URL.',
    );
  }

  return {
    bucket: SUPABASE_STORAGE_BUCKET,
    serviceRoleKey,
    supabaseUrl,
  };
}

function encodeStorageObjectKey(objectKey: string) {
  return objectKey.split('/').map(encodeURIComponent).join('/');
}

function getPublicStorageUrl(objectKey: string) {
  const { bucket, supabaseUrl } = getSupabaseStorageConfig();
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodeStorageObjectKey(
    objectKey,
  )}`;
}

function getFileExtension(file: File) {
  const fromName = path.extname(file.name).toLowerCase();
  if (fromName) return fromName;

  const fromType = file.type.split('/')[1];
  return fromType ? `.${fromType}` : '.jpg';
}

function getCategoryImageFile(formData: FormData) {
  const value = formData.get('image');
  if (!(value instanceof File)) return null;
  if (value.size === 0 || !value.type.startsWith('image/')) return null;
  return value;
}

function getImageSnapshot(file: File | null) {
  return file
    ? {
        lastModified: file.lastModified,
        name: file.name,
        size: file.size,
      }
    : null;
}

async function uploadStorageObject(objectKey: string, file: File) {
  const { bucket, serviceRoleKey, supabaseUrl } = getSupabaseStorageConfig();
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${bucket}/${encodeStorageObjectKey(
      objectKey,
    )}`,
    {
      body: Buffer.from(await file.arrayBuffer()),
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

  if (response.status === 409) return false;
  const responseText = await response.text();
  if (
    !response.ok &&
    responseText.includes('"statusCode":"409"') &&
    responseText.includes('"Duplicate"')
  ) {
    return false;
  }

  if (!response.ok) {
    throw new Error(`Failed to upload category image: ${responseText}`);
  }

  return true;
}

async function uploadCategoryImage(file: File, slug: string) {
  const extension = getFileExtension(file);
  let attempt = 1;

  while (attempt <= MAX_CATEGORY_IMAGE_UPLOAD_ATTEMPTS) {
    const suffix = attempt === 1 ? '' : `-${attempt}`;
    const objectKey = `${CATEGORY_STORAGE_FOLDER}/${slug}${suffix}${extension}`;

    if (await uploadStorageObject(objectKey, file)) {
      return getPublicStorageUrl(objectKey);
    }

    attempt += 1;
  }

  throw new Error(
    'A category image with this name already exists. Please rename the category or choose another image.',
  );
}

export async function createCategory(
  _previousState: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  await requireAdminPermission('/admin/products/categories/new', 'products.write');

  const name = getString(formData, 'name');
  if (!name) {
    return { error: 'Category name is required.' };
  }

  const slug = slugify(name);
  if (!slug) {
    return { error: 'Category name must include letters or numbers.' };
  }

  const existingCategory = await prisma.category.findUnique({
    select: {
      id: true,
    },
    where: {
      slug,
    },
  });

  if (existingCategory) {
    return { error: 'A category with this name already exists.' };
  }

  const imageFile = getCategoryImageFile(formData);
  let imagePath: string | null = null;

  try {
    imagePath = imageFile ? await uploadCategoryImage(imageFile, slug) : null;
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Category image could not be uploaded. Please try another image.',
    };
  }

  await prisma.category.create({
    data: {
      description: getOptionalString(formData, 'description'),
      imagePath,
      isActive: getBoolean(formData, 'isActive'),
      name,
      slug,
    },
  });

  revalidatePath('/admin/products/categories');
  revalidatePath('/admin/products/new');
  redirect('/admin/products/categories');
}

export async function updateCategory(
  _previousState: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  await requireAdminPermission('/admin/products/categories', 'products.write');

  const categoryId = getString(formData, 'categoryId');
  const intent = getString(formData, 'intent') || 'save';
  if (intent === 'delete') {
    if (!categoryId) {
      return { error: 'Category could not be found.' };
    }

    const existingCategory = await prisma.category.findUnique({
      select: {
        id: true,
      },
      where: {
        id: categoryId,
      },
    });

    if (!existingCategory) {
      return { error: 'Category could not be found.' };
    }

    await prisma.category.delete({
      where: {
        id: categoryId,
      },
    });

    revalidatePath('/admin/products/categories');
    revalidatePath('/admin/products/new');

    return {
      deletedAt: Date.now(),
      deletedCategoryId: categoryId,
      error: null,
      success: 'Category deleted.',
    };
  }

  if (intent === 'archive') {
    if (!categoryId) {
      return { error: 'Category could not be found.' };
    }

    const existingCategory = await prisma.category.findUnique({
      select: {
        id: true,
      },
      where: {
        id: categoryId,
      },
    });

    if (!existingCategory) {
      return { error: 'Category could not be found.' };
    }

    await prisma.category.update({
      data: { isActive: false },
      where: {
        id: categoryId,
      },
    });

    revalidatePath('/admin/products/categories');
    revalidatePath('/admin/products/new');
    revalidatePath('/api/storefront/catalog');
    revalidatePath('/products');

    return {
      archivedAt: Date.now(),
      archivedCategoryId: categoryId,
      error: null,
      success: 'Category archived.',
    };
  }

  const name = getString(formData, 'name');

  if (!categoryId) {
    return { error: 'Category could not be found.' };
  }

  if (!name) {
    return { error: 'Category name is required.' };
  }

  const slug = slugify(name);
  if (!slug) {
    return { error: 'Category name must include letters or numbers.' };
  }

  const category = await prisma.category.findUnique({
    select: {
      id: true,
      imagePath: true,
    },
    where: {
      id: categoryId,
    },
  });

  if (!category) {
    return { error: 'Category could not be found.' };
  }

  const existingCategory = await prisma.category.findUnique({
    select: {
      id: true,
    },
    where: {
      slug,
    },
  });

  if (existingCategory && existingCategory.id !== categoryId) {
    return { error: 'A category with this name already exists.' };
  }

  const imageFile = getCategoryImageFile(formData);
  let imagePath = category.imagePath;

  try {
    imagePath = imageFile ? await uploadCategoryImage(imageFile, slug) : imagePath;
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Category image could not be uploaded. Please try another image.',
    };
  }

  await prisma.category.update({
    data: {
      description: getOptionalString(formData, 'description'),
      imagePath,
      isActive: getBoolean(formData, 'isActive'),
      name,
      slug,
    },
    where: {
      id: categoryId,
    },
  });

  revalidatePath('/admin/products/categories');
  revalidatePath('/admin/products/new');

  return {
    error: null,
    savedAt: Date.now(),
    savedSnapshot: JSON.stringify({
      description: getOptionalString(formData, 'description') ?? '',
      image: getImageSnapshot(imageFile),
      isActive: getBoolean(formData, 'isActive'),
      name,
      slug,
    }),
    success: 'Category saved.',
  };
}
