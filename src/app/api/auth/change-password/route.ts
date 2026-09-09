import { NextRequest, NextResponse } from "next/server";
import { createSession, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { changePasswordSchema } from "@/lib/validations";
import argon2 from "argon2";
import { PASSWORD_OPTIONS, verifyPassword } from "@/lib/passwords";
import { consumeAuthBudget, readJson, securityError } from "@/lib/security";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request, { allowPasswordChange: true });

    const body = await readJson(request);
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Geçersiz veri" },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = parsed.data;
    if (currentPassword === newPassword) {
      return NextResponse.json({ error: "Yeni şifre farklı olmalı" }, { status: 400 });
    }
    await consumeAuthBudget(user.id, "password-change");

    // Verify current password
    const valid = await verifyPassword(user.passwordHash, currentPassword);
    if (!valid) {
      return NextResponse.json(
        { error: "Mevcut şifre yanlış" },
        { status: 401 }
      );
    }

    // Hash new password
    const newHash = await argon2.hash(newPassword, PASSWORD_OPTIONS);

    // Update password and clear mustChangePassword
    const updated = await prisma.$transaction(async (tx) => {
      const changed = await tx.user.update({
        where: { id: user.id, updatedAt: user.updatedAt, active: true },
        data: {
          passwordHash: newHash,
          mustChangePassword: false,
          updatedAt: new Date(Math.max(Date.now(), user.updatedAt.getTime() + 1)),
        },
      });
      await tx.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return changed;
    });

    // Get business for audit
    const branch = await prisma.branch.findUnique({
      where: { id: user.branchId },
      select: { businessId: true },
    });

    if (branch) {
      await logAudit({
        businessId: branch.businessId,
        actorId: user.id,
        action: user.mustChangePassword
          ? AUDIT_ACTIONS.PASSWORD_FORCE_CHANGED
          : AUDIT_ACTIONS.PASSWORD_CHANGED,
        targetType: "user",
        targetId: user.id,
      });
    }

    const response = NextResponse.json({ success: true });
    await createSession(updated, response);
    return response;
  } catch (error) {
    const failure = securityError(error);
    if (failure) return failure;
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
