import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { staffCreateSchema } from "@/lib/validations";
import argon2 from "argon2";
import { PASSWORD_OPTIONS } from "@/lib/passwords";
import { consumeAuthBudget, readJson, securityError } from "@/lib/security";

export async function GET(request: NextRequest) {
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

    const staff = await prisma.user.findMany({
      where: {
        branch: { businessId: business.id },
      },
      include: {
        branch: {
          select: { id: true, name: true, slug: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      staff: staff.map((s) => ({
        id: s.id,
        email: s.email,
        role: s.role,
        active: s.active,
        mustChangePassword: s.mustChangePassword,
        createdAt: s.createdAt,
        branch: s.branch,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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
    const parsed = staffCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Geçersiz veri" },
        { status: 400 }
      );
    }

    const { email, password, role, branchId } = parsed.data;

    // Verify branch belongs to business
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, businessId: business.id, active: true },
    });
    if (!branch) {
      return NextResponse.json(
        { error: "Geçersiz şube" },
        { status: 400 }
      );
    }

    // Check email uniqueness
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Bu e-posta adresi zaten kayıtlı" },
        { status: 409 }
      );
    }

    await consumeAuthBudget(user.id, "staff-create");
    const passwordHash = await argon2.hash(password, PASSWORD_OPTIONS);
    const newUser = await prisma.user.create({
      data: {
        branchId,
        email,
        passwordHash,
        role,
        mustChangePassword: true,
      },
      include: {
        branch: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    await logAudit({
      businessId: business.id,
      actorId: user.id,
      action: AUDIT_ACTIONS.USER_CREATED,
      targetType: "user",
      targetId: newUser.id,
      metadata: { email, role, branchId },
    });

    return NextResponse.json({
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        active: newUser.active,
        mustChangePassword: newUser.mustChangePassword,
        branch: newUser.branch,
      },
    }, { status: 201 });
  } catch (error) {
    const failure = securityError(error);
    if (failure) return failure;
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
