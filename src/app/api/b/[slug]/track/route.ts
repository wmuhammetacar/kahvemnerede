import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { trackSchema } from "@/lib/validations";
import { findBranchBySlug } from "@/lib/branch";
import {
  consumePublicLookupBudget,
  securityError,
} from "@/lib/security";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    await consumePublicLookupBudget(ip, slug);

    const branch = await findBranchBySlug(slug);
    if (!branch) {
      return NextResponse.json(
        { error: "Şube bulunamadı" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = trackSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Geçersiz sipariş numarası" },
        { status: 400 }
      );
    }

    const { orderNumber } = parsed.data;

    const order = await prisma.order.findFirst({
      where: {
        branchId: branch.id,
        orderNumber,
        status: { in: ["WAITING", "READY"] },
      },
      select: {
        id: true,
        orderNumber: true,
        trackingToken: true,
        status: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Aktif sipariş bulunamadı" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      trackingToken: order.trackingToken,
      orderNumber: order.orderNumber,
      status: order.status,
    });
  } catch (e) {
    const securityResponse = securityError(e);
    if (securityResponse) return securityResponse;
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
