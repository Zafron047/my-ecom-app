UPDATE "AdminUser"
SET "role" = 'supaAdmin'
WHERE "role" = 'admin'
  AND "isActive" = true
  AND NOT EXISTS (
    SELECT 1
    FROM "AdminUser" existing_supa_admin
    WHERE existing_supa_admin."role" = 'supaAdmin'
      AND existing_supa_admin."isActive" = true
  );
