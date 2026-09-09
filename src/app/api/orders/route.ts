import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { orderCreateSchema } from "@/lib/validations";
import { eventBus } from "@/lib/events";
import crypto from "crypto";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const where: Prisma.OrderWhereInput = { branchId: user.branchId, status: { in: ["WAITING", "READY"] } };
    if (status && !["WAITING", "READY"].includes(status)) {
      return NextResponse.json({ error: "Use history for completed orders" }, { status: 400 });
    }
    if (status === "WAITING" || status === "READY") {
      where.status = status;
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ orders });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const parsed = orderCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { orderNumber } = parsed.data;

    // Check for duplicate active order
    const existing = await prisma.order.findFirst({
      where: {
        branchId: user.branchId,
        orderNumber,
        status: { in: ["WAITING", "READY"] },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Bu sipariş numarası zaten aktif" },
        { status: 409 }
      );
    }

    const trackingToken = crypto.randomBytes(32).toString("hex");

    const order = await prisma.order.create({
      data: {
        branchId: user.branchId,
        orderNumber,
        trackingToken,
        status: "WAITING",
      },
    });

    eventBus.publish(`orders:${user.branchId}`, JSON.stringify({
      type: "ORDER_CREATED",
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        createdAt: order.createdAt.toISOString(),
      },
    }));

    return NextResponse.json({ order }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "Bu sipariş numarası zaten aktif" }, { status: 409 });
    }
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
