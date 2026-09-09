-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Europe/Istanbul';

-- CreateIndex
CREATE INDEX "Branch_businessId_idx" ON "Branch"("businessId");

-- CreateIndex
CREATE INDEX "Order_branchId_createdAt_idx" ON "Order"("branchId", "createdAt");
