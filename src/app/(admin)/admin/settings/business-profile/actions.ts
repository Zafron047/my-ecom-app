'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import path from 'path';
import { randomUUID } from 'crypto';
import { requireAdminRole } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';
import type { BusinessProfileActionState } from '@/components/admin/BusinessProfileFormShell';

const BUSINESS_IMAGES_STORAGE_FOLDER = 'Business Images';
const SUPABASE_STORAGE_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET || 'product-images';

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function optionalString(formData: FormData, key: string) {
  const value = getString(formData, key);
  return value || null;
}

type BusinessProfileData = {
  address: string | null;
  businessName: string;
  tagline: string | null;
  bannerAlt: string | null;
  bannerUrl: string | null;
  email: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  logoAlt: string | null;
  logoUrl: string | null;
  metaDescription: string | null;
  metaKeywords: string | null;
  metaTitle: string | null;
  ogImageUrl: string | null;
  phone: string | null;
  returnRefundPolicy: string | null;
  websiteUrl: string | null;
};

function revalidateBusinessProfilePaths() {
  revalidateTag('storefront-business-profile', 'max');
  revalidatePath('/');
  revalidatePath('/api/storefront/catalog');
  revalidatePath('/admin/settings/business-profile');
}

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

function getSupabaseStorageConfig() {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Logo uploads require SUPABASE_SERVICE_ROLE_KEY. Set SUPABASE_URL too if it cannot be inferred from DATABASE_URL.',
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

function getImageFile(formData: FormData, key: string) {
  const value = formData.get(key);
  if (!(value instanceof File)) return null;
  if (value.size === 0 || !value.type.startsWith('image/')) return null;
  return value;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function uploadBusinessImage(
  file: File,
  businessName: string,
  imageType: 'banner' | 'logo' | 'metadata',
  altText: string | null,
) {
  const { bucket, serviceRoleKey, supabaseUrl } = getSupabaseStorageConfig();
  const extension = getFileExtension(file);
  const objectKey = `${BUSINESS_IMAGES_STORAGE_FOLDER}/${slugify(businessName) || 'business'}-${imageType}-${Date.now()}${extension}`;

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

  if (!response.ok) {
    throw new Error(`Failed to upload business image: ${await response.text()}`);
  }

  const publicUrl = getPublicStorageUrl(objectKey);

  await prisma.$executeRaw`
    INSERT INTO "BusinessImage" (
      "id",
      "imageType",
      "title",
      "altText",
      "storagePath",
      "publicUrl",
      "fileName",
      "contentType",
      "sizeBytes",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${randomUUID()},
      ${imageType},
      ${file.name || `${businessName} ${imageType}`},
      ${altText},
      ${objectKey},
      ${publicUrl},
      ${file.name || null},
      ${file.type || null},
      ${file.size},
      ${new Date()},
      ${new Date()}
    )
  `;

  return publicUrl;
}

async function deleteStorageObject(objectKey: string) {
  const { bucket, serviceRoleKey, supabaseUrl } = getSupabaseStorageConfig();
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${bucket}/${encodeStorageObjectKey(
      objectKey,
    )}`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      method: 'DELETE',
    },
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to delete business image: ${await response.text()}`);
  }
}

async function upsertBusinessProfileWithRawSql(data: BusinessProfileData) {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id"
    FROM "BusinessProfile"
    ORDER BY "updatedAt" DESC
    LIMIT 1
  `;
  const existingProfile = rows[0];

  if (existingProfile) {
    await prisma.$executeRaw`
      UPDATE "BusinessProfile"
      SET
        "address" = ${data.address},
        "bannerAlt" = ${data.bannerAlt},
        "bannerUrl" = ${data.bannerUrl},
        "businessName" = ${data.businessName},
        "tagline" = ${data.tagline},
        "email" = ${data.email},
        "facebookUrl" = ${data.facebookUrl},
        "instagramUrl" = ${data.instagramUrl},
        "logoAlt" = ${data.logoAlt},
        "logoUrl" = ${data.logoUrl},
        "metaDescription" = ${data.metaDescription},
        "metaKeywords" = ${data.metaKeywords},
        "metaTitle" = ${data.metaTitle},
        "ogImageUrl" = ${data.ogImageUrl},
        "phone" = ${data.phone},
        "returnRefundPolicy" = ${data.returnRefundPolicy},
        "websiteUrl" = ${data.websiteUrl},
        "updatedAt" = ${new Date()}
      WHERE "id" = ${existingProfile.id}
    `;
    return;
  }

  await prisma.$executeRaw`
    INSERT INTO "BusinessProfile" (
      "id",
      "address",
      "bannerAlt",
      "bannerUrl",
      "businessName",
      "tagline",
      "email",
      "facebookUrl",
      "instagramUrl",
      "logoAlt",
      "logoUrl",
      "metaDescription",
      "metaKeywords",
      "metaTitle",
      "ogImageUrl",
      "phone",
      "returnRefundPolicy",
      "websiteUrl",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${randomUUID()},
      ${data.address},
      ${data.bannerAlt},
      ${data.bannerUrl},
      ${data.businessName},
      ${data.tagline},
      ${data.email},
      ${data.facebookUrl},
      ${data.instagramUrl},
      ${data.logoAlt},
      ${data.logoUrl},
      ${data.metaDescription},
      ${data.metaKeywords},
      ${data.metaTitle},
      ${data.ogImageUrl},
      ${data.phone},
      ${data.returnRefundPolicy},
      ${data.websiteUrl},
      ${new Date()},
      ${new Date()}
    )
  `;
}

export async function saveBusinessProfile(formData: FormData) {
  await requireAdminRole('/admin/settings/business-profile', ['admin']);

  const businessName = getString(formData, 'businessName');
  if (!businessName) {
    throw new Error('Business name is required.');
  }

  const logoAlt = optionalString(formData, 'logoAlt');
  const bannerAlt = optionalString(formData, 'bannerAlt');
  const metadataAlt = optionalString(formData, 'metaTitle') || `${businessName} social preview`;
  const logoFile = getImageFile(formData, 'logoFile');
  const bannerFile = getImageFile(formData, 'bannerFile');
  const metadataImageFile = getImageFile(formData, 'metadataImageFile');
  const uploadedLogoUrl = logoFile
    ? await uploadBusinessImage(logoFile, businessName, 'logo', logoAlt)
    : null;
  const uploadedBannerUrl = bannerFile
    ? await uploadBusinessImage(bannerFile, businessName, 'banner', bannerAlt)
    : null;
  const uploadedMetadataImageUrl = metadataImageFile
    ? await uploadBusinessImage(
        metadataImageFile,
        businessName,
        'metadata',
        metadataAlt,
      )
    : null;
  const data = {
    address: optionalString(formData, 'address'),
    bannerAlt,
    bannerUrl: uploadedBannerUrl ?? optionalString(formData, 'bannerUrl'),
    businessName,
    tagline: optionalString(formData, 'tagline'),
    email: optionalString(formData, 'email'),
    facebookUrl: optionalString(formData, 'facebookUrl'),
    instagramUrl: optionalString(formData, 'instagramUrl'),
    logoAlt,
    logoUrl: uploadedLogoUrl ?? optionalString(formData, 'logoUrl'),
    metaDescription: optionalString(formData, 'metaDescription'),
    metaKeywords: optionalString(formData, 'metaKeywords'),
    metaTitle: optionalString(formData, 'metaTitle'),
    ogImageUrl: uploadedMetadataImageUrl ?? optionalString(formData, 'ogImageUrl'),
    phone: optionalString(formData, 'phone'),
    returnRefundPolicy: optionalString(formData, 'returnRefundPolicy'),
    websiteUrl: optionalString(formData, 'websiteUrl'),
  } satisfies BusinessProfileData;

  await upsertBusinessProfileWithRawSql(data);

  revalidateBusinessProfilePaths();
}

export async function saveBusinessProfileWithState(
  _state: BusinessProfileActionState,
  formData: FormData,
): Promise<BusinessProfileActionState> {
  try {
    await saveBusinessProfile(formData);
    return {
      message: 'Business profile saved.',
      status: 'success',
    };
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : 'Business profile could not be saved.',
      status: 'error',
    };
  }
}

export async function saveBusinessProfileImage(formData: FormData) {
  await requireAdminRole('/admin/settings/business-profile', ['admin']);

  const imageSlot = getString(formData, 'businessImageSlot');
  if (!['banner', 'logo', 'metadata'].includes(imageSlot)) {
    throw new Error('Image slot is required.');
  }

  const deleteImageId = getString(formData, 'deleteImageId');
  if (deleteImageId) {
    await deleteBusinessImageById(deleteImageId);
    revalidateBusinessProfilePaths();
    return;
  }

  const businessName = getString(formData, 'businessName') || 'BDBuyEasy';
  const slotConfig =
    imageSlot === 'logo'
      ? {
          alt: optionalString(formData, 'logoAlt'),
          fileKey: 'logoFile',
          profileColumn: 'logoUrl' as const,
          selectedUrlKey: 'logoUrl',
          type: 'logo' as const,
        }
      : imageSlot === 'banner'
        ? {
            alt: optionalString(formData, 'bannerAlt'),
            fileKey: 'bannerFile',
            profileColumn: 'bannerUrl' as const,
            selectedUrlKey: 'bannerUrl',
            type: 'banner' as const,
          }
        : {
            alt:
              optionalString(formData, 'metaTitle') ||
              `${businessName} social preview`,
            fileKey: 'metadataImageFile',
            profileColumn: 'ogImageUrl' as const,
            selectedUrlKey: 'ogImageUrl',
            type: 'metadata' as const,
          };

  const imageFile = getImageFile(formData, slotConfig.fileKey);
  const imageUrl = imageFile
    ? await uploadBusinessImage(
        imageFile,
        businessName,
        slotConfig.type,
        slotConfig.alt,
      )
    : optionalString(formData, slotConfig.selectedUrlKey);

  if (!imageUrl) {
    throw new Error('Choose or upload an image before saving.');
  }

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id"
    FROM "BusinessProfile"
    ORDER BY "updatedAt" DESC
    LIMIT 1
  `;
  const existingProfile = rows[0];

  if (existingProfile) {
    if (slotConfig.profileColumn === 'logoUrl') {
      await prisma.$executeRaw`
        UPDATE "BusinessProfile"
        SET "logoUrl" = ${imageUrl}, "logoAlt" = ${slotConfig.alt}, "updatedAt" = ${new Date()}
        WHERE "id" = ${existingProfile.id}
      `;
    } else if (slotConfig.profileColumn === 'bannerUrl') {
      await prisma.$executeRaw`
        UPDATE "BusinessProfile"
        SET "bannerUrl" = ${imageUrl}, "bannerAlt" = ${slotConfig.alt}, "updatedAt" = ${new Date()}
        WHERE "id" = ${existingProfile.id}
      `;
    } else {
      await prisma.$executeRaw`
        UPDATE "BusinessProfile"
        SET "ogImageUrl" = ${imageUrl}, "updatedAt" = ${new Date()}
        WHERE "id" = ${existingProfile.id}
      `;
    }
  } else {
    await upsertBusinessProfileWithRawSql({
      address: null,
      bannerAlt: imageSlot === 'banner' ? slotConfig.alt : null,
      bannerUrl: imageSlot === 'banner' ? imageUrl : null,
      businessName,
      tagline: null,
      email: null,
      facebookUrl: null,
      instagramUrl: null,
      logoAlt: imageSlot === 'logo' ? slotConfig.alt : null,
      logoUrl: imageSlot === 'logo' ? imageUrl : null,
      metaDescription: null,
      metaKeywords: null,
      metaTitle: null,
      ogImageUrl: imageSlot === 'metadata' ? imageUrl : null,
      phone: null,
      returnRefundPolicy: null,
      websiteUrl: null,
    });
  }

  revalidateBusinessProfilePaths();
}

async function deleteBusinessImageById(imageId: string) {
  if (!imageId) {
    throw new Error('Image id is required.');
  }

  const rows = await prisma.$queryRaw<
    { publicUrl: string; storagePath: string }[]
  >`
    SELECT "publicUrl", "storagePath"
    FROM "BusinessImage"
    WHERE "id" = ${imageId}
    LIMIT 1
  `;
  const image = rows[0];
  if (!image) return;

  await deleteStorageObject(image.storagePath);

  await prisma.$executeRaw`
    DELETE FROM "BusinessImage"
    WHERE "id" = ${imageId}
  `;

  await prisma.$executeRaw`
    UPDATE "BusinessProfile"
    SET
      "logoUrl" = CASE WHEN "logoUrl" = ${image.publicUrl} THEN NULL ELSE "logoUrl" END,
      "bannerUrl" = CASE WHEN "bannerUrl" = ${image.publicUrl} THEN NULL ELSE "bannerUrl" END,
      "ogImageUrl" = CASE WHEN "ogImageUrl" = ${image.publicUrl} THEN NULL ELSE "ogImageUrl" END,
      "updatedAt" = ${new Date()}
    WHERE
      "logoUrl" = ${image.publicUrl}
      OR "bannerUrl" = ${image.publicUrl}
      OR "ogImageUrl" = ${image.publicUrl}
  `;
}

export async function deleteBusinessImage(imageId: string, formData: FormData) {
  await requireAdminRole('/admin/settings/business-profile', ['admin']);
  void formData;

  await deleteBusinessImageById(imageId);
  revalidateBusinessProfilePaths();
}
