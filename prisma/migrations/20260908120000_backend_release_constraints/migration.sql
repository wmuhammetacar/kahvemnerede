BEGIN;

-- Block writes between validation and index replacement. Never rename public URLs.
LOCK TABLE "Branch", "Order" IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Branch" GROUP BY "slug" HAVING COUNT(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate branch slugs exist. Resolve public URL ownership explicitly before retrying this migration.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "Order" WHERE "status" IN ('WAITING', 'READY')
    GROUP BY "branchId", "orderNumber" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate active order numbers exist. Resolve conflicting active orders before retrying this migration.';
  END IF;
END $$;

CREATE UNIQUE INDEX "Branch_slug_key" ON "Branch"("slug");
DROP INDEX "Branch_businessId_slug_key";
DROP INDEX "Order_branchId_orderNumber_status_key";
CREATE UNIQUE INDEX "Order_active_number_key" ON "Order"("branchId", "orderNumber")
  WHERE "status" IN ('WAITING', 'READY');

COMMIT;
