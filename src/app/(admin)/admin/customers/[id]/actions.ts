'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminPermission } from '@/lib/admin-session';
import { prisma } from '@/lib/prisma';

type UpdateCustomerPayload = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  division: string;
  district: string;
  thana: string;
  address: string;
  customerType: string;
  identifierTag: string;
  behaviorTags: string[];
  notes: string;
  isBlocked: boolean;
};

const CUSTOMER_TYPES = new Set(['retail', 'reseller'] as const);
const IDENTIFIER_TAGS = new Set([
  'NEW',
  'RISING',
  'PRIORITY',
  'HIGH_PRIORITY',
  'RISKY',
  'HIGH_RISKY',
] as const);
const BEHAVIOR_TAGS = new Set([
  'HIGH_VALUE_BUYER',
  'PREPAID_BUYER',
  'BULK_BUYER',
  'DISCOUNT_SEEKER',
] as const);

export async function updateCustomerDetailsAction(
  customerId: string,
  payload: UpdateCustomerPayload,
) {
  await requireAdminPermission(`/admin/customers/${customerId}`, 'customers.read');

  const customerType = CUSTOMER_TYPES.has(payload.customerType as never)
    ? payload.customerType
    : 'retail';
  const identifierTag = IDENTIFIER_TAGS.has(payload.identifierTag as never)
    ? payload.identifierTag
    : 'NEW';
  const behaviorTags = payload.behaviorTags.filter((tag) =>
    BEHAVIOR_TAGS.has(tag as never),
  );

  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: {
      firstName: payload.firstName.trim(),
      lastName: payload.lastName.trim() || null,
      email: payload.email.trim() || null,
      phone: payload.phone.trim(),
      division: payload.division.trim() || null,
      district: payload.district.trim() || null,
      thana: payload.thana.trim() || null,
      address: payload.address.trim() || null,
      customerType: customerType as never,
      identifierTag: identifierTag as never,
      behaviorTags: behaviorTags as never,
      notes: payload.notes.trim() || null,
      isBlocked: payload.isBlocked,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      division: true,
      district: true,
      thana: true,
      address: true,
      customerType: true,
      identifierTag: true,
      behaviorTags: true,
      notes: true,
      isBlocked: true,
    },
  });

  revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath('/admin/customers');

  return {
    id: updated.id,
    firstName: updated.firstName,
    lastName: updated.lastName ?? '',
    email: updated.email ?? '',
    phone: updated.phone,
    division: updated.division ?? '',
    district: updated.district ?? '',
    thana: updated.thana ?? '',
    address: updated.address ?? '',
    customerType: updated.customerType,
    identifierTag: updated.identifierTag,
    behaviorTags: updated.behaviorTags,
    notes: updated.notes ?? '',
    isBlocked: updated.isBlocked,
  };
}
