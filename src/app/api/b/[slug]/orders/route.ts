import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findBranchBySlug } from "@/lib/branch";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const branch = await findBranchBySlug(slug);
    if (!branch) {
      return NextResponse.json({ error: "Şube bulunamadı" }, { status: 404 });
    }

    const orders = await prisma.order.findMany({
      where: { branchId: branch.id, status: "READY" },
      select: { orderNumber: true, status: true, readyAt: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ orders });
  } catch {
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
