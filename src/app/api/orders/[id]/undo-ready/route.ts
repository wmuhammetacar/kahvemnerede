import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { eventBus } from "@/lib/events";
import { Prisma } from "@prisma/client";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const order = await prisma.order.findFirst({
      where: {
        id,
        branchId: user.branchId,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Sipariş bulunamadı veya zaten hazır değil" },
        { status: 404 }
      );
    }

    const now = new Date();
    const updated = await prisma.order.update({
      where: { id, branchId: user.branchId, status: "READY", readyAt: { gte: new Date(now.getTime() - 8000), lte: now } },
      data: {
        status: "WAITING",
        readyAt: null,
      },
    });

    eventBus.publish(`orders:${user.branchId}`, JSON.stringify({
      type: "ORDER_UPDATED",
      order: {
        id: updated.id,
        orderNumber: updated.orderNumber,
        status: updated.status,
        createdAt: updated.createdAt.toISOString(),
        readyAt: null,
      },
    }));

    eventBus.publish(`track:${order.trackingToken}`, JSON.stringify({
      status: "WAITING",
      orderNumber: order.orderNumber,
    }));

    // Notify display (branch-scoped)
    eventBus.publish(`display:ready:${user.branchId}`, JSON.stringify({
      type: "READY_REMOVED",
      orderNumber: order.orderNumber,
    }));

    return NextResponse.json({ order: updated });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && ["P2025", "P2002"].includes(e.code)) {
      return NextResponse.json({ error: "Sipariş durumu değişti veya geri alma süresi doldu" }, { status: 409 });
    }
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
