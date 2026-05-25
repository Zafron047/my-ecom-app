'use server';

import { revalidatePath } from 'next/cache';
import { Prisma, ProductStatus } from '@prisma/client';
import { requireAdminPermission } from '@/lib/admin-session';
import {
  createOpeningStockBatches,
  type OpeningStockBatchInput,
} from '@/lib/opening-stock-batches';
import { prisma } from '@/lib/prisma';

type RestoreMode = 'dry-run' | 'apply';

export type BackupRestoreState = {
  error: string | null;
  message: string | null;
  processed: number;
  stockBatchesCreated: number;
  stockBatchesToCreate: number;
  toCreate: number;
  toUpdate: number;
  errors: string[];
  errorCsv: string | null;
  preview: BackupRestorePreviewItem[];
};

const INITIAL_STATE: BackupRestoreState = {
  error: null,
  message: null,
  processed: 0,
  stockBatchesCreated: 0,
  stockBatchesToCreate: 0,
  toCreate: 0,
  toUpdate: 0,
  errors: [],
  errorCsv: null,
  preview: [],
};

export type BackupRestorePreviewItem = {
  row: number;
  sku: string;
  action: 'create' | 'update' | 'no-change';
  changes: Array<{
    field: string;
    from: string;
    to: string;
  }>;
};

export type CatalogQaIssue = {
  code:
    | 'missing_required'
    | 'duplicate_sku'
    | 'duplicate_slug'
    | 'broken_image_url'
    | 'invalid_stock'
    | 'draft_item';
  entityType: 'product' | 'variant';
  entityId: string;
  label: string;
  message: string;
};

export type CatalogQaState = {
  error: string | null;
  message: string | null;
  checkedProducts: number;
  checkedVariants: number;
  totalIssues: number;
  issueCounts: Record<CatalogQaIssue['code'], number>;
  issues: CatalogQaIssue[];
};

export type InventoryBatchRestoreState = {
  error: string | null;
  message: string | null;
  processed: number;
  toCreate: number;
  skipped: number;
  errors: string[];
  errorCsv: string | null;
  preview: InventoryBatchRestorePreviewItem[];
};

const INVENTORY_BATCH_RESTORE_INITIAL_STATE: InventoryBatchRestoreState = {
  error: null,
  message: null,
  processed: 0,
  toCreate: 0,
  skipped: 0,
  errors: [],
  errorCsv: null,
  preview: [],
};

export type InventoryBatchRestorePreviewItem = {
  row: number;
  batchNumber: string;
  action: 'create' | 'skip' | 'no-change';
  changes: Array<{
    field: string;
    from: string;
    to: string;
  }>;
};

export type StockBatchRepairState = {
  error: string | null;
  message: string | null;
  stockBatchesCreated: number;
  stockBatchesToCreate: number;
  totalQuantity: number;
};

const STOCK_BATCH_REPAIR_INITIAL_STATE: StockBatchRepairState = {
  error: null,
  message: null,
  stockBatchesCreated: 0,
  stockBatchesToCreate: 0,
  totalQuantity: 0,
};

type ParsedRow = Record<string, string>;

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function normalizeSku(value: string) {
  return value.trim().toUpperCase();
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function parseCsv(content: string): ParsedRow[] {
  const lines: string[] = [];
  let currentLine = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentLine += '"';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      currentLine += char;
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      const trimmed = currentLine.trim();
      if (trimmed) {
        lines.push(trimmed);
      }
      currentLine = '';
      if (char === '\r' && next === '\n') {
        i += 1;
      }
      continue;
    }

    currentLine += char;
  }

  const lastTrimmed = currentLine.trim();
  if (lastTrimmed) {
    lines.push(lastTrimmed);
  }

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCsvLine(lines[i]);
    const row: ParsedRow = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });

    rows.push(row);
  }

  return rows;
}

function parseDecimal(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed.toFixed(2);
}

function parseRequiredDecimal(value: string) {
  const parsed = parseDecimal(value);
  if (parsed === null) return null;
  return new Prisma.Decimal(parsed);
}

function parseRequiredPositiveInt(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseRequiredNonNegativeInt(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
}

function parseBackupDate(value: string) {
  const normalized = value.trim();
  if (!normalized) return new Date();
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseStock(value: string) {
  const normalized = value.trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 0) return 0;
  return parsed;
}

function parseStatus(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === ProductStatus.active) return ProductStatus.active;
  if (normalized === ProductStatus.archived) return ProductStatus.archived;
  return ProductStatus.draft;
}

function parseBoolean(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }
  return true;
}

function getField(row: ParsedRow, keys: string[]) {
  for (const key of keys) {
    if (key in row) return row[key] ?? '';
  }
  return '';
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '').trim();
}

function normalizeDynamicAttribute(value: string | null | undefined) {
  return normalizeText(value).normalize('NFKC').replace(/\s+/g, ' ');
}

function normalizeComparableText(value: string | null | undefined) {
  return normalizeText(value).normalize('NFKC').replace(/\s+/g, ' ');
}

function normalizeCurrency(
  value: string | { toNumber: () => number } | null | undefined,
) {
  if (!value) return '';
  const numeric = typeof value === 'string' ? Number(value) : value.toNumber();
  return Number.isFinite(numeric) ? numeric.toFixed(2) : '';
}

function normalizeCategories(value: string) {
  return value
    .split('|')
    .map((item) => normalizeCategoryName(item))
    .filter(Boolean)
    .sort()
    .join(' | ');
}

function normalizeCategoryName(value: string) {
  return normalizeComparableText(value).replace(/"/g, '');
}

function asDisplayValue(value: string | null | undefined) {
  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : '(empty)';
}

type FieldComparison = {
  field: string;
  from: string;
  to: string;
};

function toChangedFields(comparisons: FieldComparison[]) {
  return comparisons.filter((comparison) => comparison.from !== comparison.to);
}

async function ensureUniqueSlug(baseSlug: string, currentProductId?: string) {
  let candidate = baseSlug || `product-${Date.now()}`;
  let suffix = 2;

  while (true) {
    const existing = await prisma.product.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing || (currentProductId && existing.id === currentProductId)) {
      return candidate;
    }

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

function pushQaIssue(
  issues: CatalogQaIssue[],
  issueCounts: Record<CatalogQaIssue['code'], number>,
  issue: CatalogQaIssue,
) {
  issues.push(issue);
  issueCounts[issue.code] = (issueCounts[issue.code] ?? 0) + 1;
}

function isProbablyHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function buildErrorCsv(errorRows: Array<{ row: number; error: string }>) {
  return [
    'row,error',
    ...errorRows.map((item) =>
      `${item.row},"${item.error.replace(/"/g, '""')}"`,
    ),
  ].join('\n');
}

function isBatchManagedVariant(
  variant:
    | {
        _count?: {
          inventoryAllocations: number;
          inventoryBatches: number;
        };
      }
    | null,
) {
  return Boolean(
    variant &&
      ((variant._count?.inventoryBatches ?? 0) > 0 ||
        (variant._count?.inventoryAllocations ?? 0) > 0),
  );
}

function stockManagementChange(
  existingVariant: {
    _count?: {
      inventoryAllocations: number;
      inventoryBatches: number;
    };
    stockQuantity: number;
  } | null,
  targetStock: number,
) {
  if (targetStock <= 0) return null;
  if (!existingVariant) return 'create opening stock batch';
  if (!isBatchManagedVariant(existingVariant)) {
    return 'create opening stock batch';
  }
  if (existingVariant.stockQuantity === targetStock) {
    return 'already batch-managed';
  }
  return 'stock managed by PO batches';
}

async function runStockBatchRepair(mode: RestoreMode) {
  const variants = await prisma.productVariant.findMany({
    orderBy: [{ product: { name: 'asc' } }, { sortOrder: 'asc' }],
    select: {
      _count: {
        select: {
          inventoryAllocations: true,
          inventoryBatches: true,
        },
      },
      costPrice: true,
      id: true,
      productId: true,
      sku: true,
      stockQuantity: true,
    },
    where: {
      stockQuantity: { gt: 0 },
    },
  });

  const repairRows: OpeningStockBatchInput[] = variants
    .filter((variant) => !isBatchManagedVariant(variant))
    .map((variant) => ({
      productId: variant.productId,
      quantity: variant.stockQuantity,
      sku: variant.sku,
      unitCost: variant.costPrice,
      variantId: variant.id,
    }));

  const totalQuantity = repairRows.reduce(
    (sum, variant) => sum + variant.quantity,
    0,
  );

  if (mode !== 'apply' || repairRows.length === 0) {
    return {
      batchCount: 0,
      orderNumber: null,
      stockBatchesToCreate: repairRows.length,
      totalQuantity,
    };
  }

  const result = await prisma.$transaction(
    (tx) =>
      createOpeningStockBatches(tx, {
        note: 'Stock batch repair for positive variant stock without inventory batches.',
        orderNumberPrefix: 'PO-REPAIR',
        variants: repairRows,
      }),
    { timeout: 60_000 },
  );

  return {
    ...result,
    stockBatchesToCreate: repairRows.length,
  };
}

export async function repairMissingStockBatchesAction(
  _prevState: StockBatchRepairState,
  formData: FormData,
): Promise<StockBatchRepairState> {
  await requireAdminPermission('/admin/settings/backup', 'backups.manage');

  const modeRaw = formData.get('mode');
  const mode: RestoreMode = modeRaw === 'apply' ? 'apply' : 'dry-run';

  try {
    const result = await runStockBatchRepair(mode);

    if (mode === 'apply') {
      revalidatePath('/admin/settings/backup');
      revalidatePath('/admin/products/stock');
      revalidatePath('/admin/purchase-order');
    }

    return {
      error: null,
      message:
        mode === 'apply'
          ? result.batchCount > 0
            ? `Missing stock batches created in ${result.orderNumber}.`
            : 'No missing stock batches found.'
          : result.stockBatchesToCreate > 0
            ? `${result.stockBatchesToCreate} variant(s) have stock without batches.`
            : 'No missing stock batches found.',
      stockBatchesCreated: result.batchCount,
      stockBatchesToCreate: result.stockBatchesToCreate,
      totalQuantity: result.totalQuantity,
    };
  } catch (error) {
    return {
      ...STOCK_BATCH_REPAIR_INITIAL_STATE,
      error:
        error instanceof Error && error.message
          ? error.message
          : 'Failed to repair missing stock batches.',
    };
  }
}

type ParsedInventoryBatchRow = {
  batchNumber: string;
  purchaseDate: Date;
  purchaseOrderNumber: string;
  receivedAt: Date;
  receivedQuantity: number;
  remainingQuantity: number;
  rowNumber: number;
  status: string;
  unitCost: Prisma.Decimal;
  variantId: string;
  variantSku: string;
};

function normalizeBatchStatus(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'depleted') return 'depleted';
  if (normalized === 'reserved') return 'reserved';
  return 'available';
}

function fallbackRestoreOrderNumber() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/\D/g, '');
  return `PO-BATCH-RESTORE-${datePart}`;
}

async function syncVariantStockFromBatches(
  tx: Prisma.TransactionClient,
  variantIds: string[],
) {
  const uniqueVariantIds = Array.from(new Set(variantIds));
  if (uniqueVariantIds.length === 0) return;

  const sums = await tx.inventoryBatch.groupBy({
    by: ['variantId'],
    where: {
      variantId: { in: uniqueVariantIds },
    },
    _sum: {
      remainingQuantity: true,
    },
  });
  const stockByVariantId = new Map(
    sums.map((row) => [row.variantId, row._sum.remainingQuantity ?? 0]),
  );

  for (const variantId of uniqueVariantIds) {
    await tx.productVariant.update({
      data: {
        stockQuantity: stockByVariantId.get(variantId) ?? 0,
      },
      where: { id: variantId },
    });
  }
}

export async function restoreInventoryBatchesBackupAction(
  _prevState: InventoryBatchRestoreState,
  formData: FormData,
): Promise<InventoryBatchRestoreState> {
  await requireAdminPermission('/admin/settings/backup', 'backups.manage');

  const modeRaw = formData.get('mode');
  const mode: RestoreMode = modeRaw === 'apply' ? 'apply' : 'dry-run';
  const file = formData.get('inventoryBackupFile');

  if (!(file instanceof File) || file.size === 0) {
    return {
      ...INVENTORY_BATCH_RESTORE_INITIAL_STATE,
      error: 'Please select an inventory batch CSV file.',
    };
  }

  const rows = parseCsv(await file.text());
  if (rows.length === 0) {
    return {
      ...INVENTORY_BATCH_RESTORE_INITIAL_STATE,
      error: 'CSV has no data rows.',
    };
  }

  const errors: string[] = [];
  const errorRows: Array<{ row: number; error: string }> = [];
  const preview: InventoryBatchRestorePreviewItem[] = [];
  const seenBatchNumbers = new Map<string, number>();
  const uniqueBatchNumbers = new Set<string>();
  const uniqueSkus = new Set<string>();

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const batchNumber = getField(row, ['batch_number', 'batch']).trim();
    const sku = normalizeSku(getField(row, ['variant_sku', 'sku']));
    if (batchNumber) uniqueBatchNumbers.add(batchNumber);
    if (sku) uniqueSkus.add(sku);
  }

  const [variants, existingBatches] = await Promise.all([
    uniqueSkus.size > 0
      ? prisma.productVariant.findMany({
          where: { sku: { in: Array.from(uniqueSkus) } },
          select: {
            id: true,
            productId: true,
            sku: true,
          },
        })
      : Promise.resolve([]),
    uniqueBatchNumbers.size > 0
      ? prisma.inventoryBatch.findMany({
          where: { batchNumber: { in: Array.from(uniqueBatchNumbers) } },
          select: {
            batchNumber: true,
            receivedAt: true,
            receivedQuantity: true,
            remainingQuantity: true,
            status: true,
            unitCost: true,
            variant: {
              select: { sku: true },
            },
            purchaseOrderLine: {
              select: {
                purchaseOrder: {
                  select: {
                    orderNumber: true,
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const variantBySku = new Map(variants.map((variant) => [variant.sku, variant]));
  const batchByNumber = new Map(
    existingBatches.map((batch) => [batch.batchNumber, batch]),
  );
  const validRows: ParsedInventoryBatchRow[] = [];
  let toCreate = 0;
  let skipped = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNumber = index + 2;
    const batchNumber = getField(row, ['batch_number', 'batch']).trim();
    const variantSku = normalizeSku(getField(row, ['variant_sku', 'sku']));
    const purchaseOrderNumber =
      getField(row, ['purchase_order_number', 'po_number', 'order_number']).trim() ||
      fallbackRestoreOrderNumber();
    const purchaseDate = parseBackupDate(getField(row, ['purchase_date']));
    const receivedAt = parseBackupDate(getField(row, ['received_at']));
    const receivedQuantity = parseRequiredPositiveInt(
      getField(row, ['received_quantity', 'quantity']),
    );
    const remainingQuantity = parseRequiredNonNegativeInt(
      getField(row, ['remaining_quantity']),
    );
    const unitCost = parseRequiredDecimal(getField(row, ['unit_cost', 'cost']));
    const status = normalizeBatchStatus(getField(row, ['batch_status', 'status']));

    if (!batchNumber) {
      const msg = 'batch_number is required.';
      errors.push(`Row ${rowNumber}: ${msg}`);
      errorRows.push({ row: rowNumber, error: msg });
      continue;
    }
    if (!variantSku) {
      const msg = 'variant_sku is required.';
      errors.push(`Row ${rowNumber}: ${msg}`);
      errorRows.push({ row: rowNumber, error: msg });
      continue;
    }
    const firstSeenRow = seenBatchNumbers.get(batchNumber);
    if (typeof firstSeenRow === 'number') {
      const msg = `duplicate batch_number. First seen at row ${firstSeenRow}.`;
      errors.push(`Row ${rowNumber}: ${msg}`);
      errorRows.push({ row: rowNumber, error: msg });
      continue;
    }
    seenBatchNumbers.set(batchNumber, rowNumber);

    const variant = variantBySku.get(variantSku);
    if (!variant) {
      const msg = `unknown variant_sku (${variantSku}). Restore catalog first.`;
      errors.push(`Row ${rowNumber}: ${msg}`);
      errorRows.push({ row: rowNumber, error: msg });
      continue;
    }
    if (!purchaseDate || !receivedAt) {
      const msg = 'purchase_date or received_at is invalid.';
      errors.push(`Row ${rowNumber}: ${msg}`);
      errorRows.push({ row: rowNumber, error: msg });
      continue;
    }
    if (receivedQuantity === null) {
      const msg = 'received_quantity must be a positive whole number.';
      errors.push(`Row ${rowNumber}: ${msg}`);
      errorRows.push({ row: rowNumber, error: msg });
      continue;
    }
    if (remainingQuantity === null) {
      const msg = 'remaining_quantity must be a non-negative whole number.';
      errors.push(`Row ${rowNumber}: ${msg}`);
      errorRows.push({ row: rowNumber, error: msg });
      continue;
    }
    if (remainingQuantity > receivedQuantity) {
      const msg = 'remaining_quantity cannot exceed received_quantity.';
      errors.push(`Row ${rowNumber}: ${msg}`);
      errorRows.push({ row: rowNumber, error: msg });
      continue;
    }
    if (!unitCost) {
      const msg = 'unit_cost must be a valid amount.';
      errors.push(`Row ${rowNumber}: ${msg}`);
      errorRows.push({ row: rowNumber, error: msg });
      continue;
    }

    const existingBatch = batchByNumber.get(batchNumber) ?? null;
    if (existingBatch) {
      const comparisons: FieldComparison[] = [
        {
          field: 'purchase_order_number',
          from: existingBatch.purchaseOrderLine.purchaseOrder.orderNumber,
          to: purchaseOrderNumber,
        },
        {
          field: 'variant_sku',
          from: normalizeSku(existingBatch.variant.sku),
          to: variantSku,
        },
        {
          field: 'received_quantity',
          from: String(existingBatch.receivedQuantity),
          to: String(receivedQuantity),
        },
        {
          field: 'remaining_quantity',
          from: String(existingBatch.remainingQuantity),
          to: String(remainingQuantity),
        },
        {
          field: 'unit_cost',
          from: normalizeCurrency(existingBatch.unitCost),
          to: unitCost.toFixed(2),
        },
        {
          field: 'batch_status',
          from: existingBatch.status,
          to: status,
        },
      ];
      const changes = toChangedFields(comparisons);
      if (changes.length > 0) {
        const msg = `batch_number already exists with different values (${changes
          .map((change) => change.field)
          .join(', ')}).`;
        errors.push(`Row ${rowNumber}: ${msg}`);
        errorRows.push({ row: rowNumber, error: msg });
        if (preview.length < 50) {
          preview.push({
            row: rowNumber,
            batchNumber,
            action: 'skip',
            changes: changes.map((change) => ({
              field: change.field,
              from: asDisplayValue(change.from),
              to: asDisplayValue(change.to),
            })),
          });
        }
        skipped += 1;
        continue;
      }

      skipped += 1;
      if (preview.length < 50) {
        preview.push({
          row: rowNumber,
          batchNumber,
          action: 'no-change',
          changes: [],
        });
      }
      continue;
    }

    toCreate += 1;
    validRows.push({
      batchNumber,
      purchaseDate,
      purchaseOrderNumber,
      receivedAt,
      receivedQuantity,
      remainingQuantity,
      rowNumber,
      status,
      unitCost,
      variantId: variant.id,
      variantSku,
    });

    if (preview.length < 50) {
      preview.push({
        row: rowNumber,
        batchNumber,
        action: 'create',
        changes: [
          {
            field: 'inventory_batch',
            from: '(new)',
            to: `${variantSku} / ${remainingQuantity} remaining`,
          },
        ],
      });
    }
  }

  if (errors.length > 0) {
    return {
      error: null,
      message:
        mode === 'apply'
          ? 'Inventory batch restore finished with errors. Fix rows and upload again.'
          : 'Inventory batch dry run finished with validation errors.',
      processed: rows.length,
      toCreate,
      skipped,
      errors: errors.slice(0, 100),
      errorCsv: buildErrorCsv(errorRows),
      preview,
    };
  }

  if (mode === 'apply' && validRows.length > 0) {
    await prisma.$transaction(
      async (tx) => {
        const rowsByOrderNumber = new Map<string, ParsedInventoryBatchRow[]>();
        for (const row of validRows) {
          const rowsForOrder = rowsByOrderNumber.get(row.purchaseOrderNumber) ?? [];
          rowsForOrder.push(row);
          rowsByOrderNumber.set(row.purchaseOrderNumber, rowsForOrder);
        }

        for (const [orderNumber, orderRows] of rowsByOrderNumber) {
          const totalQuantity = orderRows.reduce(
            (sum, row) => sum + row.receivedQuantity,
            0,
          );
          const totalCost = orderRows.reduce(
            (sum, row) => sum.add(row.unitCost.mul(row.receivedQuantity)),
            new Prisma.Decimal(0),
          );
          const purchaseDate = orderRows[0]?.purchaseDate ?? new Date();
          const receivedAt = orderRows.reduce(
            (latest, row) =>
              row.receivedAt.getTime() > latest.getTime() ? row.receivedAt : latest,
            orderRows[0]?.receivedAt ?? new Date(),
          );
          const purchaseOrder = await tx.purchaseOrder.upsert({
            where: { orderNumber },
            create: {
              notes: 'Inventory batches restored from backup CSV.',
              orderNumber,
              paidAmount: new Prisma.Decimal(0),
              paymentStatus: 'due',
              purchaseDate,
              receivedAt,
              status: 'received',
              supplierName: 'Inventory batch restore',
              totalCost,
              totalQuantity,
            },
            update: {
              totalCost: { increment: totalCost },
              totalQuantity: { increment: totalQuantity },
            },
            select: { id: true },
          });

          for (const row of orderRows) {
            const line = await tx.purchaseOrderLine.create({
              data: {
                batchNumber: row.batchNumber,
                lineTotal: row.unitCost.mul(row.receivedQuantity),
                productId:
                  variantBySku.get(row.variantSku)?.productId ??
                  undefined,
                purchaseOrderId: purchaseOrder.id,
                quantity: row.receivedQuantity,
                unitCost: row.unitCost,
                variantId: row.variantId,
              },
              select: { id: true },
            });

            await tx.inventoryBatch.create({
              data: {
                batchNumber: row.batchNumber,
                purchaseOrderLineId: line.id,
                receivedAt: row.receivedAt,
                receivedQuantity: row.receivedQuantity,
                remainingQuantity: row.remainingQuantity,
                status: row.status,
                unitCost: row.unitCost,
                variantId: row.variantId,
              },
            });
          }
        }

        await syncVariantStockFromBatches(
          tx,
          validRows.map((row) => row.variantId),
        );
      },
      { timeout: 60_000 },
    );

    revalidatePath('/admin/settings/backup');
    revalidatePath('/admin/products/stock');
    revalidatePath('/admin/purchase-order');
  }

  return {
    error: null,
    message:
      mode === 'apply'
        ? 'Inventory batch restore applied successfully.'
        : 'Inventory batch dry run successful. No validation errors found.',
    processed: rows.length,
    toCreate,
    skipped,
    errors: [],
    errorCsv: null,
    preview,
  };
}

export async function restoreProductsBackupAction(
  _prevState: BackupRestoreState,
  formData: FormData,
): Promise<BackupRestoreState> {
  await requireAdminPermission('/admin/settings/backup', 'backups.manage');

  const modeRaw = formData.get('mode');
  const mode: RestoreMode = modeRaw === 'apply' ? 'apply' : 'dry-run';
  const file = formData.get('backupFile');

  if (!(file instanceof File) || file.size === 0) {
    return {
      ...INITIAL_STATE,
      error: 'Please select a CSV file.',
    };
  }

  const content = await file.text();
  const rows = parseCsv(content);
  if (rows.length === 0) {
    return {
      ...INITIAL_STATE,
      error: 'CSV has no data rows.',
    };
  }

  const errors: string[] = [];
  const errorRows: Array<{ row: number; error: string }> = [];
  let toCreate = 0;
  let toUpdate = 0;
  let stockBatchesCreated = 0;
  let stockBatchesToCreate = 0;
  const openingStockRows: OpeningStockBatchInput[] = [];
  const normalizedSkuRows = new Map<string, number>();
  const touchedProductIds = new Set<string>();
  const previewTouchedProductKeys = new Set<string>();
  const productHasPricelessVariantCache = new Map<string, boolean>();
  const uniqueSkus = new Set<string>();
  const uniqueBrandNames = new Set<string>();
  const uniqueCategoryNames = new Set<string>();
  const uniqueRequestedSlugs = new Set<string>();
  const preview: BackupRestorePreviewItem[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const sku = normalizeSku(getField(row, ['variant_sku', 'sku']));
    if (sku) uniqueSkus.add(sku);
    const brandName = getField(row, ['product_brand', 'brand']).trim();
    if (brandName) uniqueBrandNames.add(brandName);
    const categoriesRaw = getField(row, ['product_categories', 'category']).trim();
    if (categoriesRaw) {
      for (const name of categoriesRaw.split('|').map((item) => item.trim()).filter(Boolean)) {
        uniqueCategoryNames.add(name);
      }
    }
    const title = getField(row, ['product_title', 'title']).trim();
    const slugRaw = getField(row, ['product_slug', 'slug']).trim();
    if (title || slugRaw) uniqueRequestedSlugs.add(slugify(slugRaw || title));
  }

  const [existingVariants, existingBrands, existingCategories, productsBySlug] = await Promise.all([
    uniqueSkus.size > 0
      ? prisma.productVariant.findMany({
          where: { sku: { in: Array.from(uniqueSkus) } },
          select: {
            _count: {
              select: {
                inventoryAllocations: true,
                inventoryBatches: true,
              },
            },
            id: true,
            sku: true,
            productId: true,
            color: true,
            size: true,
            price: true,
            compareAtPrice: true,
            costPrice: true,
            stockQuantity: true,
            reorderLevel: true,
            isActive: true,
            product: {
              select: {
                name: true,
                slug: true,
                status: true,
                brand: { select: { name: true } },
                shortDescription: true,
                description: true,
                seoTitle: true,
                seoDescription: true,
                images: {
                  take: 1,
                  orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
                  select: { storagePath: true },
                },
                categories: {
                  select: {
                    category: { select: { name: true } },
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
    uniqueBrandNames.size > 0
      ? prisma.brand.findMany({
          where: { name: { in: Array.from(uniqueBrandNames) } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    uniqueCategoryNames.size > 0
      ? prisma.category.findMany({
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    uniqueRequestedSlugs.size > 0
      ? prisma.product.findMany({
          where: { slug: { in: Array.from(uniqueRequestedSlugs) } },
          select: {
            brand: { select: { name: true } },
            categories: {
              select: {
                category: { select: { name: true } },
              },
            },
            description: true,
            id: true,
            images: {
              take: 1,
              orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
              select: { storagePath: true },
            },
            name: true,
            seoDescription: true,
            seoTitle: true,
            shortDescription: true,
            slug: true,
            status: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const existingVariantBySku = new Map(existingVariants.map((variant) => [variant.sku, variant]));
  const brandIdByName = new Map(existingBrands.map((brand) => [brand.name, brand.id]));
  const categoryByName = new Map(existingCategories.map((category) => [category.name, category]));
  const categoryByNormalizedName = new Map(
    existingCategories.map((category) => [
      normalizeCategoryName(category.name),
      category,
    ]),
  );
  const productIdBySlug = new Map(productsBySlug.map((product) => [product.slug, product.id]));
  const productBySlug = new Map(productsBySlug.map((product) => [product.slug, product]));
  const resolvedSlugCache = new Map<string, string>();

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const rowNumber = i + 2;

    const variantSku = normalizeSku(
      getField(row, ['variant_sku', 'sku']),
    );
    const productTitle = getField(row, ['product_title', 'title']).trim();
    const productSlugRaw = getField(row, ['product_slug', 'slug']).trim();
    const productStatusRaw = getField(row, ['product_status', 'status']);
    const productBrandRaw = getField(row, ['product_brand', 'brand']).trim();
    const productCategoriesRaw = getField(row, [
      'product_categories',
      'category',
    ]).trim();
    const productShortDescription = getField(row, [
      'product_short_description',
      'short_description',
    ]).trim();
    const productDescription = getField(row, [
      'product_description',
      'description',
    ]).trim();
    const productSeoTitle = getField(row, ['product_seo_title', 'seo_title']).trim();
    const productSeoDescription = getField(row, [
      'product_seo_description',
      'seo_description',
    ]).trim();
    const productImageUrl = getField(row, [
      'product_image_url',
      'image_url',
      'product_image',
    ]).trim();

    const variantPriceRaw = getField(row, ['variant_price', 'price']);
    const variantCompareAtRaw = getField(row, [
      'variant_compare_at_price',
      'sale_price',
    ]);
    const variantCostRaw = getField(row, ['variant_cost_price']);
    const variantColor =
      normalizeDynamicAttribute(getField(row, ['variant_color', 'color'])) || null;
    const variantSize =
      normalizeDynamicAttribute(getField(row, ['variant_size', 'size'])) || null;
    const variantStock = parseStock(
      getField(row, ['variant_stock_quantity', 'stock']),
    );
    const variantReorderLevel = parseStock(
      getField(row, ['variant_reorder_level', 'reorder_level']),
    );
    const variantIsActive = parseBoolean(
      getField(row, ['variant_is_active', 'is_active']),
    );

    if (!productTitle) {
      const msg = 'product_title is required.';
      errors.push(`Row ${rowNumber}: ${msg}`);
      errorRows.push({ row: rowNumber, error: msg });
      continue;
    }

    const parsedVariantPriceInput = variantPriceRaw.trim();
    if (parsedVariantPriceInput.length > 0 && parseDecimal(parsedVariantPriceInput) === null) {
      const msg = 'variant_price must be a valid amount.';
      errors.push(`Row ${rowNumber}: ${msg}`);
      errorRows.push({ row: rowNumber, error: msg });
      continue;
    }
    const parsedCompareAt =
      variantCompareAtRaw.trim().length > 0 ? parseDecimal(variantCompareAtRaw) : null;
    if (variantCompareAtRaw.trim().length > 0 && parsedCompareAt === null) {
      const msg = 'variant_compare_at_price is invalid.';
      errors.push(`Row ${rowNumber}: ${msg}`);
      errorRows.push({ row: rowNumber, error: msg });
      continue;
    }
    const parsedCost =
      variantCostRaw.trim().length > 0 ? parseDecimal(variantCostRaw) : null;
    if (variantCostRaw.trim().length > 0 && parsedCost === null) {
      const msg = 'variant_cost_price is invalid.';
      errors.push(`Row ${rowNumber}: ${msg}`);
      errorRows.push({ row: rowNumber, error: msg });
      continue;
    }
    const categoryNames = productCategoriesRaw
      .split('|')
      .map((item) => item.trim())
      .filter(Boolean);
    const hasVariantData =
      Boolean(variantSku) ||
      Boolean(variantColor) ||
      Boolean(variantSize) ||
      parsedVariantPriceInput.length > 0 ||
      variantCompareAtRaw.trim().length > 0 ||
      variantCostRaw.trim().length > 0 ||
      getField(row, ['variant_stock_quantity', 'stock']).trim().length > 0 ||
      getField(row, ['variant_reorder_level', 'reorder_level']).trim().length > 0 ||
      getField(row, ['variant_is_active', 'is_active']).trim().length > 0;

    if (!variantSku && !hasVariantData) {
      const requestedSlug = slugify(productSlugRaw || productTitle);
      const existingProduct = productBySlug.get(requestedSlug) ?? null;
      const targetCategories = normalizeCategories(productCategoriesRaw);

      if (mode === 'dry-run' && preview.length < 50) {
        const changes: BackupRestorePreviewItem['changes'] = [];
        if (!existingProduct) {
          changes.push({ field: 'product_title', from: '(new)', to: productTitle });
          changes.push({ field: 'product_slug', from: '(new)', to: requestedSlug });
        } else {
          const currentCategories = normalizeCategories(
            existingProduct.categories
              .map((item) => item.category.name)
              .join(' | '),
          );
          const currentPrimaryImage = normalizeText(
            existingProduct.images[0]?.storagePath,
          );
          const comparisons: FieldComparison[] = [
            {
              field: 'product_title',
              from: normalizeText(existingProduct.name),
              to: productTitle,
            },
            {
              field: 'product_slug',
              from: normalizeText(existingProduct.slug),
              to: requestedSlug,
            },
            {
              field: 'product_status',
              from: existingProduct.status,
              to: parseStatus(productStatusRaw),
            },
            {
              field: 'product_brand',
              from: normalizeText(existingProduct.brand?.name),
              to: productBrandRaw,
            },
            {
              field: 'product_categories',
              from: currentCategories,
              to: targetCategories,
            },
            {
              field: 'product_image_url',
              from: currentPrimaryImage,
              to: normalizeText(productImageUrl),
            },
            {
              field: 'product_short_description',
              from: normalizeComparableText(existingProduct.shortDescription),
              to: normalizeComparableText(productShortDescription),
            },
            {
              field: 'product_description',
              from: normalizeComparableText(existingProduct.description),
              to: normalizeComparableText(productDescription),
            },
            {
              field: 'product_seo_title',
              from: normalizeComparableText(existingProduct.seoTitle),
              to: normalizeComparableText(productSeoTitle),
            },
            {
              field: 'product_seo_description',
              from: normalizeComparableText(existingProduct.seoDescription),
              to: normalizeComparableText(productSeoDescription),
            },
          ];
          changes.push(...toChangedFields(comparisons).map((comparison) => ({
            field: comparison.field,
            from: asDisplayValue(comparison.from),
            to: asDisplayValue(comparison.to),
          })));
        }

        const previewAction: BackupRestorePreviewItem['action'] = !existingProduct
          ? 'create'
          : changes.length > 0
            ? 'update'
            : 'no-change';
        preview.push({
          row: rowNumber,
          sku: requestedSlug || productTitle,
          action: previewAction,
          changes,
        });
        if (previewAction === 'create') toCreate += 1;
        if (previewAction === 'update') toUpdate += 1;
      }

      if (mode !== 'apply') continue;

      const categories = categoryNames
        .map((name) => categoryByName.get(name) ?? categoryByNormalizedName.get(normalizeCategoryName(name)))
        .filter((item): item is { id: string; name: string } => Boolean(item));
      const missingCategories = categoryNames.filter(
        (name) => !categoryByName.has(name) && !categoryByNormalizedName.has(normalizeCategoryName(name)),
      );
      if (missingCategories.length > 0) {
        const msg = `unknown categories (${missingCategories.join(', ')}).`;
        errors.push(`Row ${rowNumber}: ${msg}`);
        errorRows.push({ row: rowNumber, error: msg });
        continue;
      }

      const brandId = productBrandRaw ? (brandIdByName.get(productBrandRaw) ?? null) : null;
      if (productBrandRaw && !brandId) {
        const msg = `unknown brand (${productBrandRaw}).`;
        errors.push(`Row ${rowNumber}: ${msg}`);
        errorRows.push({ row: rowNumber, error: msg });
        continue;
      }

      let productId = existingProduct?.id ?? null;
      const finalSlug = await ensureUniqueSlug(requestedSlug, productId ?? undefined);
      const productData = {
        name: productTitle,
        slug: finalSlug,
        status: parseStatus(productStatusRaw),
        brandId,
        shortDescription: productShortDescription || null,
        description: productDescription || null,
        seoTitle: productSeoTitle || null,
        seoDescription: productSeoDescription || null,
      };

      if (productId) {
        await prisma.product.update({
          data: productData,
          where: { id: productId },
        });
        toUpdate += 1;
      } else {
        const createdProduct = await prisma.product.create({
          data: productData,
          select: { id: true },
        });
        productId = createdProduct.id;
        toCreate += 1;
      }

      if (productId && !touchedProductIds.has(productId)) {
        touchedProductIds.add(productId);
        await prisma.productCategory.deleteMany({
          where: { productId },
        });
        if (categories.length > 0) {
          await prisma.productCategory.createMany({
            data: categories.map((category) => ({
              categoryId: category.id,
              productId,
            })),
            skipDuplicates: true,
          });
        }
      }
      continue;
    }

    if (!variantSku) {
      const msg = 'variant_sku is required when variant fields are present.';
      errors.push(`Row ${rowNumber}: ${msg}`);
      errorRows.push({ row: rowNumber, error: msg });
      continue;
    }

    const firstSeenRow = normalizedSkuRows.get(variantSku);
    if (typeof firstSeenRow === 'number') {
      const msg = `duplicate variant_sku after normalization. First seen at row ${firstSeenRow}.`;
      errors.push(`Row ${rowNumber}: ${msg}`);
      errorRows.push({ row: rowNumber, error: msg });
      continue;
    }
    normalizedSkuRows.set(variantSku, rowNumber);

    const existingVariant = existingVariantBySku.get(variantSku) ?? null;
    const stockChangeMode = stockManagementChange(existingVariant, variantStock);

    if (
      isBatchManagedVariant(existingVariant) &&
      variantStock !== existingVariant?.stockQuantity
    ) {
      const msg =
        'variant_stock_quantity is already managed by inventory batches. Update stock through PO receiving instead.';
      errors.push(`Row ${rowNumber}: ${msg}`);
      errorRows.push({ row: rowNumber, error: msg });
      continue;
    }
    if (
      mode === 'dry-run' &&
      stockChangeMode === 'create opening stock batch' &&
      variantStock > 0
    ) {
      stockBatchesToCreate += 1;
    }

    const isVariantPriceMissingInCsv = parsedVariantPriceInput.length === 0;
    const previewProductKey = existingVariant
      ? `id:${existingVariant.productId}`
      : `slug:${slugify(productSlugRaw || productTitle)}`;
    const isFirstPreviewRowForProduct = !previewTouchedProductKeys.has(previewProductKey);
    if (isFirstPreviewRowForProduct) {
      previewTouchedProductKeys.add(previewProductKey);
    }

    let existingProductHasPricelessVariant = false;
    if (existingVariant?.productId) {
      const cached = productHasPricelessVariantCache.get(existingVariant.productId);
      if (typeof cached === 'boolean') {
        existingProductHasPricelessVariant = cached;
      } else {
        const found = await prisma.productVariant.findFirst({
          where: {
            productId: existingVariant.productId,
            price: { lte: '0' },
          },
          select: { id: true },
        });
        existingProductHasPricelessVariant = Boolean(found);
        productHasPricelessVariantCache.set(existingVariant.productId, existingProductHasPricelessVariant);
      }
    }

    const parsedVariantPrice =
      parsedVariantPriceInput.length > 0
        ? (parseDecimal(parsedVariantPriceInput) as string)
        : existingVariant
          ? normalizeCurrency(existingVariant.price)
          : '0.00';
    const hasAnyImage =
      Boolean(productImageUrl) || (existingVariant?.product.images.length ?? 0) > 0;
    const requestedStatus = parseStatus(productStatusRaw);
    let effectiveStatus =
      requestedStatus === ProductStatus.active &&
      (categoryNames.length === 0 || Number(parsedVariantPrice) <= 0 || !hasAnyImage)
        ? ProductStatus.draft
        : requestedStatus;
    if (existingProductHasPricelessVariant || isVariantPriceMissingInCsv) {
      effectiveStatus = ProductStatus.draft;
    }
    const effectiveVariantIsActive =
      categoryNames.length === 0 || Number(parsedVariantPrice) <= 0 || !hasAnyImage
        ? false
        : variantIsActive;

    if (mode === 'dry-run' && preview.length < 50) {
      const changes: BackupRestorePreviewItem['changes'] = [];
      const targetSlug = slugify(productSlugRaw || productTitle);
      const targetCategories = normalizeCategories(productCategoriesRaw);

      if (!existingVariant) {
        changes.push({ field: 'product_title', from: '(new)', to: productTitle });
        changes.push({ field: 'product_slug', from: '(new)', to: targetSlug });
        changes.push({ field: 'variant_price', from: '(new)', to: parsedVariantPrice });
        changes.push({
          field: 'opening_stock_batch',
          from: '(new)',
          to: variantStock > 0 ? `${variantStock} unit(s)` : 'none',
        });
      } else {
        const currentCategories = normalizeCategories(
          existingVariant.product.categories
            .map((item) => item.category.name)
            .join(' | '),
        );
        const currentPrimaryImage = normalizeText(
          existingVariant.product.images[0]?.storagePath,
        );
        const variantComparisons: FieldComparison[] = [
          { field: 'variant_color', from: normalizeText(existingVariant.color), to: normalizeText(variantColor) },
          { field: 'variant_size', from: normalizeText(existingVariant.size), to: normalizeText(variantSize) },
          {
            field: 'variant_price',
            from: normalizeCurrency(existingVariant.price),
            to: parsedVariantPrice,
          },
          {
            field: 'variant_compare_at_price',
            from: normalizeCurrency(existingVariant.compareAtPrice),
            to: parsedCompareAt ?? '',
          },
          {
            field: 'variant_cost_price',
            from: normalizeCurrency(existingVariant.costPrice),
            to: parsedCost ?? '',
          },
          {
            field: 'opening_stock_batch',
            from:
              stockChangeMode === 'create opening stock batch'
                ? 'none'
                : (stockChangeMode ?? 'none'),
            to:
              stockChangeMode === 'create opening stock batch'
                ? `${variantStock} unit(s)`
                : (stockChangeMode ?? 'none'),
          },
          {
            field: 'variant_reorder_level',
            from: String(existingVariant.reorderLevel),
            to: String(variantReorderLevel),
          },
          {
            field: 'variant_is_active',
            from: existingVariant.isActive ? 'true' : 'false',
            to: effectiveVariantIsActive ? 'true' : 'false',
          },
        ];
        const productComparisons: FieldComparison[] = isFirstPreviewRowForProduct
          ? [
              {
                field: 'product_title',
                from: normalizeText(existingVariant.product.name),
                to: productTitle,
              },
              {
                field: 'product_slug',
                from: normalizeText(existingVariant.product.slug),
                to: targetSlug,
              },
              {
                field: 'product_status',
                from: existingVariant.product.status,
                to: effectiveStatus,
              },
              {
                field: 'product_brand',
                from: normalizeText(existingVariant.product.brand?.name),
                to: productBrandRaw,
              },
              {
                field: 'product_categories',
                from: currentCategories,
                to: targetCategories,
              },
              {
                field: 'product_image_url',
                from: currentPrimaryImage,
                to: normalizeText(productImageUrl),
              },
              {
                field: 'product_short_description',
                from: normalizeComparableText(existingVariant.product.shortDescription),
                to: normalizeComparableText(productShortDescription),
              },
              {
                field: 'product_description',
                from: normalizeComparableText(existingVariant.product.description),
                to: normalizeComparableText(productDescription),
              },
              {
                field: 'product_seo_title',
                from: normalizeComparableText(existingVariant.product.seoTitle),
                to: normalizeComparableText(productSeoTitle),
              },
              {
                field: 'product_seo_description',
                from: normalizeComparableText(existingVariant.product.seoDescription),
                to: normalizeComparableText(productSeoDescription),
              },
            ]
          : [];
        const comparisons: FieldComparison[] = [...productComparisons, ...variantComparisons];
        for (const comparison of toChangedFields(comparisons)) {
          if (comparison.from !== comparison.to) {
            changes.push({
              field: comparison.field,
              from: asDisplayValue(comparison.from),
              to: asDisplayValue(comparison.to),
            });
          }
        }
      }

      const previewAction: BackupRestorePreviewItem['action'] = !existingVariant
        ? 'create'
        : changes.length > 0
          ? 'update'
          : 'no-change';
      preview.push({
        row: rowNumber,
        sku: variantSku,
        action: previewAction,
        changes,
      });
      if (previewAction === 'create') toCreate += 1;
      if (previewAction === 'update') toUpdate += 1;
    }

    if (mode !== 'apply') continue;

    const categories = categoryNames
      .map((name) => categoryByName.get(name) ?? categoryByNormalizedName.get(normalizeCategoryName(name)))
      .filter((item): item is { id: string; name: string } => Boolean(item));
    const missingCategories = categoryNames.filter(
      (name) => !categoryByName.has(name) && !categoryByNormalizedName.has(normalizeCategoryName(name)),
    );
    if (missingCategories.length > 0) {
      const msg = `unknown categories (${missingCategories.join(', ')}).`;
      errors.push(`Row ${rowNumber}: ${msg}`);
      errorRows.push({ row: rowNumber, error: msg });
      continue;
    }

    const brandId = productBrandRaw ? (brandIdByName.get(productBrandRaw) ?? null) : null;
    if (productBrandRaw && !brandId) {
      const msg = `unknown brand (${productBrandRaw}).`;
      errors.push(`Row ${rowNumber}: ${msg}`);
      errorRows.push({ row: rowNumber, error: msg });
      continue;
    }

    let productId = existingVariant?.productId ?? null;
    let currentProductIdForSlug: string | undefined;
    if (!productId) {
      const bySlugId = productIdBySlug.get(slugify(productSlugRaw || productTitle));
      const bySlug = bySlugId ? { id: bySlugId } : null;
      if (bySlug) {
        productId = bySlug.id;
      }
    }
    if (productId) {
      currentProductIdForSlug = productId;
    }
    const requestedSlug = slugify(productSlugRaw || productTitle);
    const slugCacheKey = `${requestedSlug}::${currentProductIdForSlug ?? ''}`;
    let finalSlug = resolvedSlugCache.get(slugCacheKey);
    if (!finalSlug) {
      if (existingVariant?.product.slug === requestedSlug && currentProductIdForSlug) {
        finalSlug = requestedSlug;
      } else {
        finalSlug = await ensureUniqueSlug(requestedSlug, currentProductIdForSlug);
      }
      resolvedSlugCache.set(slugCacheKey, finalSlug);
    }
    const productData = {
      name: productTitle,
      slug: finalSlug,
      status: effectiveStatus,
      brandId,
      shortDescription: productShortDescription || null,
      description: productDescription || null,
      seoTitle: productSeoTitle || null,
      seoDescription: productSeoDescription || null,
    };

    let rowCreated = false;
    let rowUpdated = false;

    if (productId) {
      const productWriteComparisons: FieldComparison[] = !existingVariant
        ? []
        : [
            {
              field: 'product_title',
              from: normalizeComparableText(existingVariant.product.name),
              to: normalizeComparableText(productData.name),
            },
            {
              field: 'product_slug',
              from: normalizeComparableText(existingVariant.product.slug),
              to: normalizeComparableText(productData.slug),
            },
            {
              field: 'product_status',
              from: existingVariant.product.status,
              to: productData.status,
            },
            {
              field: 'product_brand',
              from: normalizeComparableText(existingVariant.product.brand?.name),
              to: normalizeComparableText(productBrandRaw),
            },
            {
              field: 'product_short_description',
              from: normalizeComparableText(existingVariant.product.shortDescription),
              to: normalizeComparableText(productData.shortDescription),
            },
            {
              field: 'product_description',
              from: normalizeComparableText(existingVariant.product.description),
              to: normalizeComparableText(productData.description),
            },
            {
              field: 'product_seo_title',
              from: normalizeComparableText(existingVariant.product.seoTitle),
              to: normalizeComparableText(productData.seoTitle),
            },
            {
              field: 'product_seo_description',
              from: normalizeComparableText(existingVariant.product.seoDescription),
              to: normalizeComparableText(productData.seoDescription),
            },
          ];
      const hasProductChanges = !existingVariant || toChangedFields(productWriteComparisons).length > 0;

      if (hasProductChanges) {
        await prisma.product.update({
          where: { id: productId },
          data: productData,
        });
        rowUpdated = true;
      }
    } else {
      const createdProduct = await prisma.product.create({
        data: productData,
        select: { id: true },
      });
      productId = createdProduct.id;
    }

    let effectiveProductStatus = productData.status;

    if (productId && !touchedProductIds.has(productId)) {
      touchedProductIds.add(productId);
      const existingCategoryIds = (
        await prisma.productCategory.findMany({
          where: { productId },
          select: { categoryId: true },
        })
      )
        .map((item) => item.categoryId)
        .sort();
      const incomingCategoryIds = categories
        .map((category) => category.id)
        .sort();
      const sameCategories =
        existingCategoryIds.length === incomingCategoryIds.length &&
        existingCategoryIds.every((id, index) => id === incomingCategoryIds[index]);

      if (!sameCategories) {
        await prisma.productCategory.deleteMany({
          where: { productId },
        });
        if (categories.length > 0) {
          await prisma.productCategory.createMany({
            data: categories.map((category) => ({
              productId,
              categoryId: category.id,
            })),
            skipDuplicates: true,
          });
        }
        rowUpdated = true;
      }
    }

    if (!productId) continue;

    const shouldForceVariantInactive =
      categoryNames.length === 0 || Number(parsedVariantPrice) <= 0 || !hasAnyImage;

    const baseVariantData = {
      productId,
      color: variantColor,
      size: variantSize,
      price: parsedVariantPrice,
      compareAtPrice: parsedCompareAt,
      costPrice: parsedCost,
      stockQuantity: isBatchManagedVariant(existingVariant)
        ? existingVariant?.stockQuantity
        : variantStock,
      reorderLevel: variantReorderLevel,
      isActive: shouldForceVariantInactive ? false : variantIsActive,
    };

    if (existingVariant) {
      const variantWriteComparisons: FieldComparison[] = [
        {
          field: 'variant_color',
          from: normalizeComparableText(existingVariant.color),
          to: normalizeComparableText(baseVariantData.color),
        },
        {
          field: 'variant_size',
          from: normalizeComparableText(existingVariant.size),
          to: normalizeComparableText(baseVariantData.size),
        },
        {
          field: 'variant_price',
          from: normalizeCurrency(existingVariant.price),
          to: normalizeCurrency(baseVariantData.price),
        },
        {
          field: 'variant_compare_at_price',
          from: normalizeCurrency(existingVariant.compareAtPrice),
          to: normalizeCurrency(baseVariantData.compareAtPrice),
        },
        {
          field: 'variant_cost_price',
          from: normalizeCurrency(existingVariant.costPrice),
          to: normalizeCurrency(baseVariantData.costPrice),
        },
        {
          field: 'variant_stock_quantity',
          from: String(existingVariant.stockQuantity),
          to: String(baseVariantData.stockQuantity),
        },
        {
          field: 'variant_reorder_level',
          from: String(existingVariant.reorderLevel),
          to: String(baseVariantData.reorderLevel),
        },
        {
          field: 'variant_is_active',
          from: existingVariant.isActive ? 'true' : 'false',
          to: baseVariantData.isActive ? 'true' : 'false',
        },
      ];
      const hasVariantChanges = toChangedFields(variantWriteComparisons).length > 0;

      if (hasVariantChanges) {
        await prisma.productVariant.update({
          where: { id: existingVariant.id },
          data: baseVariantData,
        });
        rowUpdated = true;
      }
      if (
        !isBatchManagedVariant(existingVariant) &&
        variantStock > 0
      ) {
        openingStockRows.push({
          productId,
          quantity: variantStock,
          sku: variantSku,
          unitCost: parsedCost,
          variantId: existingVariant.id,
        });
      }
    } else {
      const nextSortOrder = await prisma.productVariant.count({
        where: { productId },
      });
      const createdVariant = await prisma.productVariant.create({
        data: {
          ...baseVariantData,
          sku: variantSku,
          sortOrder: nextSortOrder,
        },
        select: { id: true },
      });
      if (variantStock > 0) {
        openingStockRows.push({
          productId,
          quantity: variantStock,
          sku: variantSku,
          unitCost: parsedCost,
          variantId: createdVariant.id,
        });
      }
      rowCreated = true;
    }

    // Final guardrail: a product cannot remain active if any variant is priceless.
    if (effectiveProductStatus !== ProductStatus.draft) {
      const hasPricelessVariant = await prisma.productVariant.findFirst({
        where: {
          productId,
          price: {
            lte: '0',
          },
        },
        select: { id: true },
      });
      if (hasPricelessVariant) {
        await prisma.product.update({
          where: { id: productId },
          data: { status: ProductStatus.draft },
        });
        effectiveProductStatus = ProductStatus.draft;
        rowUpdated = true;
      }
    }

    // CSV-level rule: if price is missing in the uploaded row, keep product in draft.
    if (isVariantPriceMissingInCsv && effectiveProductStatus !== ProductStatus.draft) {
      await prisma.product.update({
        where: { id: productId },
        data: { status: ProductStatus.draft },
      });
      effectiveProductStatus = ProductStatus.draft;
      rowUpdated = true;
    }

    if (rowCreated) {
      toCreate += 1;
    } else if (rowUpdated) {
      toUpdate += 1;
    }
  }

  if (mode === 'apply' && openingStockRows.length > 0) {
    const result = await prisma.$transaction(
      (tx) =>
        createOpeningStockBatches(tx, {
          note: 'Opening stock batches created from catalog CSV restore.',
          orderNumberPrefix: 'PO-RESTORE',
          variants: openingStockRows,
        }),
      { timeout: 60_000 },
    );
    stockBatchesCreated = result.batchCount;
    stockBatchesToCreate = openingStockRows.length;
  }

  if (errors.length > 0) {
    return {
      error: null,
      message:
        mode === 'apply'
          ? 'Restore finished with errors. Fix rows and upload again.'
          : 'Dry run finished with validation errors.',
      processed: rows.length,
      stockBatchesCreated,
      stockBatchesToCreate,
      toCreate,
      toUpdate,
      errors: errors.slice(0, 100),
      errorCsv: buildErrorCsv(errorRows),
      preview,
    };
  }

  return {
    error: null,
    message:
      mode === 'apply'
        ? 'Restore applied successfully.'
        : 'Dry run successful. No validation errors found.',
    processed: rows.length,
    stockBatchesCreated,
    stockBatchesToCreate,
    toCreate,
    toUpdate,
    errors: [],
    errorCsv: null,
    preview,
  };
}

export async function runCatalogQaChecksAction(
  prevState: CatalogQaState,
): Promise<CatalogQaState> {
  void prevState;
  await requireAdminPermission('/admin/settings/backup', 'backups.manage');

  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      stock: true,
      categories: {
        select: { categoryId: true },
      },
      images: {
        select: { storagePath: true },
        orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
      },
      variants: {
        select: {
          id: true,
          sku: true,
          stockQuantity: true,
          reorderLevel: true,
          imagePath: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const issues: CatalogQaIssue[] = [];
  const issueCounts: CatalogQaState['issueCounts'] = {
    missing_required: 0,
    duplicate_sku: 0,
    duplicate_slug: 0,
    broken_image_url: 0,
    invalid_stock: 0,
    draft_item: 0,
  };

  const skuMap = new Map<string, Array<{ variantId: string; productName: string }>>();
  const slugMap = new Map<string, Array<{ productId: string; productName: string }>>();
  let checkedVariants = 0;

  for (const product of products) {
    const productLabel = `${product.name} (${product.slug || product.id})`;
    const normalizedSlug = normalizeText(product.slug).toLowerCase();
    if (normalizedSlug) {
      const existing = slugMap.get(normalizedSlug) ?? [];
      existing.push({ productId: product.id, productName: product.name });
      slugMap.set(normalizedSlug, existing);
    }

    if (!normalizeText(product.name)) {
      pushQaIssue(issues, issueCounts, {
        code: 'missing_required',
        entityType: 'product',
        entityId: product.id,
        label: productLabel,
        message: 'Missing product name.',
      });
    }
    if (!normalizeText(product.slug)) {
      pushQaIssue(issues, issueCounts, {
        code: 'missing_required',
        entityType: 'product',
        entityId: product.id,
        label: productLabel,
        message: 'Missing product slug.',
      });
    }
    if (product.categories.length === 0) {
      pushQaIssue(issues, issueCounts, {
        code: 'missing_required',
        entityType: 'product',
        entityId: product.id,
        label: productLabel,
        message: 'No category assigned.',
      });
    }
    if (product.images.length === 0) {
      pushQaIssue(issues, issueCounts, {
        code: 'missing_required',
        entityType: 'product',
        entityId: product.id,
        label: productLabel,
        message: 'No product image found.',
      });
    }
    if (product.variants.length === 0) {
      pushQaIssue(issues, issueCounts, {
        code: 'missing_required',
        entityType: 'product',
        entityId: product.id,
        label: productLabel,
        message: 'No variants found.',
      });
    }
    if (product.status === ProductStatus.draft) {
      pushQaIssue(issues, issueCounts, {
        code: 'draft_item',
        entityType: 'product',
        entityId: product.id,
        label: productLabel,
        message: 'Product is still draft.',
      });
    }
    if (product.stock < 0) {
      pushQaIssue(issues, issueCounts, {
        code: 'invalid_stock',
        entityType: 'product',
        entityId: product.id,
        label: productLabel,
        message: `Invalid product stock (${product.stock}).`,
      });
    }

    for (const image of product.images) {
      if (!isProbablyHttpUrl(image.storagePath)) {
        pushQaIssue(issues, issueCounts, {
          code: 'broken_image_url',
          entityType: 'product',
          entityId: product.id,
          label: productLabel,
          message: `Invalid product image URL: ${image.storagePath || '(empty)'}`,
        });
      }
    }

    for (const variant of product.variants) {
      checkedVariants += 1;
      const variantLabel = `${product.name} • ${variant.sku || variant.id}`;
      const normalizedSku = normalizeSku(variant.sku ?? '');
      if (!normalizedSku) {
        pushQaIssue(issues, issueCounts, {
          code: 'missing_required',
          entityType: 'variant',
          entityId: variant.id,
          label: variantLabel,
          message: 'Missing variant SKU.',
        });
      } else {
        const existing = skuMap.get(normalizedSku) ?? [];
        existing.push({ variantId: variant.id, productName: product.name });
        skuMap.set(normalizedSku, existing);
      }

      if (variant.stockQuantity < 0 || variant.reorderLevel < 0) {
        pushQaIssue(issues, issueCounts, {
          code: 'invalid_stock',
          entityType: 'variant',
          entityId: variant.id,
          label: variantLabel,
          message: `Invalid stock fields (stock=${variant.stockQuantity}, reorder=${variant.reorderLevel}).`,
        });
      }

      if (variant.imagePath && !isProbablyHttpUrl(variant.imagePath)) {
        pushQaIssue(issues, issueCounts, {
          code: 'broken_image_url',
          entityType: 'variant',
          entityId: variant.id,
          label: variantLabel,
          message: `Invalid variant image URL: ${variant.imagePath}`,
        });
      }
    }
  }

  for (const [sku, rows] of skuMap.entries()) {
    if (rows.length <= 1) continue;
    for (const row of rows) {
      pushQaIssue(issues, issueCounts, {
        code: 'duplicate_sku',
        entityType: 'variant',
        entityId: row.variantId,
        label: `${row.productName} • ${sku}`,
        message: `Duplicate SKU after normalization (${sku}).`,
      });
    }
  }

  for (const [slug, rows] of slugMap.entries()) {
    if (rows.length <= 1) continue;
    for (const row of rows) {
      pushQaIssue(issues, issueCounts, {
        code: 'duplicate_slug',
        entityType: 'product',
        entityId: row.productId,
        label: `${row.productName} (${slug})`,
        message: `Duplicate product slug after normalization (${slug}).`,
      });
    }
  }

  return {
    error: null,
    message:
      issues.length === 0
        ? 'Catalog QA complete. No issues found.'
        : 'Catalog QA complete. Review issues below.',
    checkedProducts: products.length,
    checkedVariants,
    totalIssues: issues.length,
    issueCounts,
    issues: issues.slice(0, 500),
  };
}
