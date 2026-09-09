import { prisma } from "./prisma";

function pgArray(arr: string[]): string {
  return `{${arr.join(",")}}`;
}

export async function getSummary(
  branchIds: string[],
  start: Date,
  end: Date
) {
  if (branchIds.length === 0) {
    return {
      total: 0,
      completed: 0,
      active: 0,
      ready: 0,
      avgPreparationMs: null,
      avgPickupMs: null,
      avgTotalMs: null,
      longWaitCount: 0,
    };
  }

  const result = await prisma.$queryRawUnsafe<
    Array<{
      total: bigint;
      completed: bigint;
      active: bigint;
      ready: bigint;
      avg_preparation: number | null;
      avg_pickup: number | null;
      avg_total: number | null;
      long_wait: bigint;
    }>
  >(
    `SELECT
      COUNT(*)::int8 as total,
      COUNT(*) FILTER (WHERE "status" = 'COMPLETED')::int8 as completed,
      COUNT(*) FILTER (WHERE "status" IN ('WAITING', 'READY'))::int8 as active,
      COUNT(*) FILTER (WHERE "status" = 'READY')::int8 as ready,
      AVG(CASE WHEN "readyAt" IS NOT NULL THEN EXTRACT(EPOCH FROM ("readyAt" - "createdAt")) * 1000 END) as avg_preparation,
      AVG(CASE WHEN "completedAt" IS NOT NULL AND "readyAt" IS NOT NULL THEN EXTRACT(EPOCH FROM ("completedAt" - "readyAt")) * 1000 END) as avg_pickup,
      AVG(CASE WHEN "completedAt" IS NOT NULL THEN EXTRACT(EPOCH FROM ("completedAt" - "createdAt")) * 1000 END) as avg_total,
      COUNT(*) FILTER (WHERE "readyAt" IS NOT NULL AND EXTRACT(EPOCH FROM ("readyAt" - "createdAt")) * 1000 > 600000)::int8 as long_wait
    FROM "Order"
    WHERE "branchId" = ANY($1::text[])
      AND "createdAt" >= ($2::timestamptz AT TIME ZONE 'UTC')
      AND "createdAt" < ($3::timestamptz AT TIME ZONE 'UTC')`,
    pgArray(branchIds),
    start,
    end
  );

  const row = result[0];
  return {
    total: Number(row.total),
    completed: Number(row.completed),
    active: Number(row.active),
    ready: Number(row.ready),
    avgPreparationMs: row.avg_preparation != null ? Math.round(row.avg_preparation) : null,
    avgPickupMs: row.avg_pickup != null ? Math.round(row.avg_pickup) : null,
    avgTotalMs: row.avg_total != null ? Math.round(row.avg_total) : null,
    longWaitCount: Number(row.long_wait),
  };
}

export async function getHourlyDistribution(
  branchIds: string[],
  start: Date,
  end: Date,
  timezone: string
) {
  if (branchIds.length === 0) {
    return Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));
  }

  const result = await prisma.$queryRawUnsafe<
    Array<{ hour: number; count: bigint }>
  >(
    `SELECT
      EXTRACT(HOUR FROM "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE $4)::int as hour,
      COUNT(*)::int8 as count
    FROM "Order"
    WHERE "branchId" = ANY($1::text[])
      AND "createdAt" >= ($2::timestamptz AT TIME ZONE 'UTC')
      AND "createdAt" < ($3::timestamptz AT TIME ZONE 'UTC')
    GROUP BY EXTRACT(HOUR FROM "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE $4)
    ORDER BY hour`,
    pgArray(branchIds),
    start,
    end,
    timezone
  );

  const hourMap = new Map(result.map((r) => [r.hour, Number(r.count)]));
  return Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: hourMap.get(i) || 0,
  }));
}

export async function getDailyDistribution(
  branchIds: string[],
  start: Date,
  end: Date,
  timezone: string
) {
  if (branchIds.length === 0) {
    return [];
  }

  const result = await prisma.$queryRawUnsafe<
    Array<{ date: string; count: bigint }>
  >(
    `SELECT
      TO_CHAR("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE $1, 'YYYY-MM-DD') as date,
      COUNT(*)::int8 as count
    FROM "Order"
    WHERE "branchId" = ANY($2::text[])
      AND "createdAt" >= ($3::timestamptz AT TIME ZONE 'UTC')
      AND "createdAt" < ($4::timestamptz AT TIME ZONE 'UTC')
    GROUP BY TO_CHAR("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE $1, 'YYYY-MM-DD')
    ORDER BY date`,
    timezone,
    pgArray(branchIds),
    start,
    end
  );

  return result.map((r) => ({
    date: r.date,
    count: Number(r.count),
  }));
}

export async function getBranchComparison(
  businessId: string,
  start: Date,
  end: Date
) {
  const result = await prisma.$queryRawUnsafe<
    Array<{
      branch_id: string;
      branch_name: string;
      branch_slug: string;
      total: bigint;
      completed: bigint;
      active: bigint;
      ready: bigint;
      avg_preparation: number | null;
    }>
  >(
    `SELECT
      b."id" as branch_id,
      b."name" as branch_name,
      b."slug" as branch_slug,
      COUNT(o."id")::int8 as total,
      COUNT(o."id") FILTER (WHERE o."status" = 'COMPLETED')::int8 as completed,
      COUNT(o."id") FILTER (WHERE o."status" IN ('WAITING', 'READY'))::int8 as active,
      COUNT(o."id") FILTER (WHERE o."status" = 'READY')::int8 as ready,
      AVG(CASE WHEN o."readyAt" IS NOT NULL THEN EXTRACT(EPOCH FROM (o."readyAt" - o."createdAt")) * 1000 END) as avg_preparation
    FROM "Branch" b
    LEFT JOIN "Order" o ON o."branchId" = b."id"
      AND o."createdAt" >= ($1::timestamptz AT TIME ZONE 'UTC')
      AND o."createdAt" < ($2::timestamptz AT TIME ZONE 'UTC')
    WHERE b."businessId" = $3
    GROUP BY b."id", b."name", b."slug"
    ORDER BY total DESC`,
    start,
    end,
    businessId
  );

  return result.map((r) => ({
    branchId: r.branch_id,
    branchName: r.branch_name,
    branchSlug: r.branch_slug,
    total: Number(r.total),
    completed: Number(r.completed),
    active: Number(r.active),
    ready: Number(r.ready),
    avgPreparationMs: r.avg_preparation != null ? Math.round(r.avg_preparation) : null,
  }));
}

export async function getExportData(
  branchIds: string[],
  start: Date,
  end: Date
) {
  if (branchIds.length === 0) return [];

  const result = await prisma.$queryRawUnsafe<
    Array<{
      order_number: string;
      branch_name: string;
      branch_slug: string;
      status: string;
      created_at: Date;
      ready_at: Date | null;
      completed_at: Date | null;
      preparation_ms: number | null;
      pickup_ms: number | null;
      total_ms: number | null;
    }>
  >(
    `SELECT
      o."orderNumber" as order_number,
      b."name" as branch_name,
      b."slug" as branch_slug,
      o."status" as status,
      o."createdAt" as created_at,
      o."readyAt" as ready_at,
      o."completedAt" as completed_at,
      CASE WHEN o."readyAt" IS NOT NULL THEN EXTRACT(EPOCH FROM (o."readyAt" - o."createdAt")) * 1000 END as preparation_ms,
      CASE WHEN o."completedAt" IS NOT NULL AND o."readyAt" IS NOT NULL THEN EXTRACT(EPOCH FROM (o."completedAt" - o."readyAt")) * 1000 END as pickup_ms,
      CASE WHEN o."completedAt" IS NOT NULL THEN EXTRACT(EPOCH FROM (o."completedAt" - o."createdAt")) * 1000 END as total_ms
    FROM "Order" o
    JOIN "Branch" b ON b."id" = o."branchId"
    WHERE o."branchId" = ANY($1::text[])
      AND o."createdAt" >= ($2::timestamptz AT TIME ZONE 'UTC')
      AND o."createdAt" < ($3::timestamptz AT TIME ZONE 'UTC')
    ORDER BY o."createdAt" DESC`,
    pgArray(branchIds),
    start,
    end
  );

  return result;
}
