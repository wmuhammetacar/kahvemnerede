import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getSummary,
  getHourlyDistribution,
  getDailyDistribution,
  getBranchComparison,
} from "@/lib/reports-query";
import { formatDateRange } from "@/lib/reports";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });
    }

    const business = await prisma.business.findFirst({
      where: { branches: { some: { id: user.branchId } } },
      select: { id: true },
    });

    if (!business) {
      return NextResponse.json({ error: "İşletme bulunamadı" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "today";
    const branchId = searchParams.get("branchId");

    const branch = await prisma.branch.findUnique({
      where: { id: user.branchId },
      select: { timezone: true },
    });
    let timezone = branch?.timezone || "Europe/Istanbul";

    let branchIds: string[];

    if (branchId && branchId !== "all") {
      const targetBranch = await prisma.branch.findFirst({
        where: { id: branchId, businessId: business.id },
        select: { id: true, timezone: true },
      });
      if (!targetBranch) {
        return NextResponse.json({ error: "Şube bulunamadı" }, { status: 404 });
      }
      branchIds = [targetBranch.id];
      timezone = targetBranch.timezone;
    } else {
      const branches = await prisma.branch.findMany({
        where: { businessId: business.id },
        select: { id: true },
      });
      branchIds = branches.map((b) => b.id);
    }

    const { start, end } = formatDateRange(range, timezone);

    const [summary, hourly, daily, branches] = await Promise.all([
      getSummary(branchIds, start, end),
      getHourlyDistribution(branchIds, start, end, timezone),
      getDailyDistribution(branchIds, start, end, timezone),
      branchId === "all" || !branchId
        ? getBranchComparison(business.id, start, end)
        : null,
    ]);

    return NextResponse.json({
      summary,
      hourly,
      daily,
      branches,
      timezone,
      range,
      start: start.toISOString(),
      end: end.toISOString(),
    });
  } catch (e) {
    if (e instanceof RangeError) return NextResponse.json({ error: "Invalid report range or timezone" }, { status: 400 });
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
