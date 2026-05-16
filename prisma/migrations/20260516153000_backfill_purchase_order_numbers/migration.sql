UPDATE "PurchaseOrder" AS "order"
SET "orderNumber" = regexp_replace("order"."orderNumber", '^PE-', 'PO-')
WHERE "order"."orderNumber" LIKE 'PE-%'
  AND NOT EXISTS (
    SELECT 1
    FROM "PurchaseOrder" AS "existing"
    WHERE "existing"."orderNumber" = regexp_replace("order"."orderNumber", '^PE-', 'PO-')
      AND "existing"."id" <> "order"."id"
  );
