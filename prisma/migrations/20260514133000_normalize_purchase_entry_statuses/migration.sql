WITH received_by_entry AS (
  SELECT
    "entry"."id",
    COALESCE(SUM("batch"."receivedQuantity"), 0)::int AS "receivedQuantity"
  FROM "PurchaseEntry" AS "entry"
  LEFT JOIN "PurchaseEntryLine" AS "line"
    ON "line"."purchaseEntryId" = "entry"."id"
  LEFT JOIN "InventoryBatch" AS "batch"
    ON "batch"."purchaseEntryLineId" = "line"."id"
  GROUP BY "entry"."id"
)
UPDATE "PurchaseEntry" AS "entry"
SET "status" = CASE
  WHEN "entry"."status" = 'draft' THEN 'draft'
  WHEN "entry"."status" IN ('cancelled', 'closed_short') THEN "entry"."status"
  WHEN "entry"."paymentStatus" = 'paid'
    AND "entry"."totalQuantity" > 0
    AND "received_by_entry"."receivedQuantity" >= "entry"."totalQuantity"
    THEN 'closed'
  ELSE 'open'
END
FROM "received_by_entry"
WHERE "entry"."id" = "received_by_entry"."id"
  AND "entry"."status" IN (
    'closed',
    'full_received',
    'open',
    'partial_received',
    'received',
    'recorded'
  );
