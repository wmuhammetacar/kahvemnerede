import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { businessSettingsSchema } from "@/lib/validations";
import { readJson, securityError } from "@/lib/security";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const business = await prisma.business.findFirst({
      where: { branches: { some: { id: user.branchId } } },
      select: {
        id: true,
        name: true,
        slug: true,
        active: true,
        logoUrl: true,
        primaryColor: true,
        trackingTitle: true,
        readyMessage: true,
      },
    });
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    return NextResponse.json({ business });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const business = await prisma.business.findFirst({
      where: { branches: { some: { id: user.branchId } } },
    });
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const body = await readJson(request);
    const parsed = businessSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Geçersiz veri" },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.primaryColor !== undefined) updateData.primaryColor = data.primaryColor || null;
    if (data.trackingTitle !== undefined) updateData.trackingTitle = data.trackingTitle || null;
    if (data.readyMessage !== undefined) updateData.readyMessage = data.readyMessage || null;

    const updated = await prisma.business.update({
      where: { id: business.id },
      data: { ...updateData, updatedAt: new Date() },
      select: {
        id: true,
        name: true,
        slug: true,
        active: true,
        logoUrl: true,
        primaryColor: true,
        trackingTitle: true,
        readyMessage: true,
      },
    });

    await logAudit({
      businessId: business.id,
      actorId: user.id,
      action: AUDIT_ACTIONS.BUSINESS_SETTINGS_CHANGED,
      targetType: "business",
      targetId: business.id,
      metadata: { fields: Object.keys(updateData) },
    });

    return NextResponse.json({ business: updated });
  } catch (error) {
    const failure = securityError(error);
    if (failure) return failure;
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
