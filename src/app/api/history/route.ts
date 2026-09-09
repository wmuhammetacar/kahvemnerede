import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { localDayRange } from "@/lib/reports";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const orderNumber = searchParams.get("orderNumber");
    const filterBranchId = searchParams.get("branchId");

    const page = Number(searchParams.get("page") ?? "1");
    const pageSize = Number(searchParams.get("pageSize") ?? "50");
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100 || (page - 1) * pageSize > 2147483647) {
      return NextResponse.json({ error: "Invalid pagination" }, { status: 400 });
    }
    const ownBranch = await prisma.branch.findUnique({ where: { id: user.branchId }, select: { businessId: true, timezone: true } });
    if (!ownBranch) return NextResponse.json({ error: "Şube bulunamadı" }, { status: 404 });
    let timezone = ownBranch.timezone;
    const where: Prisma.OrderWhereInput = { branchId: user.branchId, status: "COMPLETED" };
    if (filterBranchId && filterBranchId !== user.branchId && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });
    }
    if (filterBranchId === "all" && user.role === "ADMIN") {
      delete where.branchId;
      where.branch = { businessId: ownBranch.businessId };
    } else if (filterBranchId && user.role === "ADMIN") {
      const targetBranch = await prisma.branch.findFirst({
        where: {
          id: filterBranchId,
          businessId: ownBranch.businessId,
        },
        select: { id: true, timezone: true },
      });
      if (!targetBranch) return NextResponse.json({ error: "Şube bulunamadı" }, { status: 404 });
      where.branchId = targetBranch.id;
      timezone = targetBranch.timezone;
    }

    if (date) {
      const { start, end } = localDayRange(date, timezone);
      where.createdAt = { gte: start, lt: end };
    }

    if (orderNumber) {
      where.orderNumber = orderNumber;
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: [{ completedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize + 1,
    });

    return NextResponse.json({ orders: orders.slice(0, pageSize), page, pageSize, hasMore: orders.length > pageSize, timezone });
  } catch (e) {
    if (e instanceof RangeError) return NextResponse.json({ error: "Invalid date or timezone" }, { status: 400 });
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
