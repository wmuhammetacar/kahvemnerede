import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { staffUpdateSchema } from "@/lib/validations";
import { readJson, securityError } from "@/lib/security";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    // Verify target user belongs to same business
    const targetUser = await prisma.user.findFirst({
      where: {
        id,
        branch: { businessId: business.id },
      },
    });
    if (!targetUser) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    }

    // Prevent self-disable
    if (targetUser.id === user.id) {
      return NextResponse.json(
        { error: "Kendi hesabınızı devre dışı bırakamazsınız" },
        { status: 400 }
      );
    }

    const body = await readJson(request);
    const parsed = staffUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Geçersiz veri" },
        { status: 400 }
      );
    }

    const { active, role, branchId } = parsed.data;

    // Verify new branch belongs to business if changing
    if (branchId && branchId !== targetUser.branchId) {
      const newBranch = await prisma.branch.findFirst({
        where: { id: branchId, businessId: business.id, active: true },
      });
      if (!newBranch) {
        return NextResponse.json(
          { error: "Geçersiz şube" },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const changed = await tx.user.update({
        where: { id, updatedAt: targetUser.updatedAt, branch: { businessId: business.id } },
        data: {
          active, role, branchId,
          updatedAt: new Date(Math.max(Date.now(), targetUser.updatedAt.getTime() + 1)),
        },
        include: { branch: { select: { id: true, name: true, slug: true } } },
      });
      await tx.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return changed;
    });

    // Audit log
    if (active !== undefined && active !== targetUser.active) {
      await logAudit({
        businessId: business.id,
        actorId: user.id,
        action: active ? AUDIT_ACTIONS.USER_ENABLED : AUDIT_ACTIONS.USER_DISABLED,
        targetType: "user",
        targetId: id,
        metadata: { email: updated.email },
      });
    }
    if (branchId && branchId !== targetUser.branchId) {
      await logAudit({
        businessId: business.id,
        actorId: user.id,
        action: AUDIT_ACTIONS.USER_BRANCH_REASSIGNED,
        targetType: "user",
        targetId: id,
        metadata: {
          email: updated.email,
          oldBranchId: targetUser.branchId,
          newBranchId: branchId,
        },
      });
    }
    if (role !== undefined && role !== targetUser.role) {
      await logAudit({
        businessId: business.id,
        actorId: user.id,
        action: "user.role_changed",
        targetType: "user",
        targetId: id,
        metadata: { email: updated.email, oldRole: targetUser.role, newRole: role },
      });
    }

    return NextResponse.json({
      user: {
        id: updated.id,
        email: updated.email,
        role: updated.role,
        active: updated.active,
        mustChangePassword: updated.mustChangePassword,
        branch: updated.branch,
      },
    });
  } catch (error) {
    const failure = securityError(error);
    if (failure) return failure;
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
