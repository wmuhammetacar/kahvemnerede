import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession } from "@/lib/auth";
import { loginSchema } from "@/lib/validations";
import { verifyPassword } from "@/lib/passwords";
import { consumeAuthBudget, isSameOrigin, readJson, securityError } from "@/lib/security";

export async function POST(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }
    const body = await readJson(request);
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Geçersiz e-posta veya şifre" },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    await consumeAuthBudget(email);

    const user = await prisma.user.findUnique({
      where: { email },
      include: { branch: { include: { business: true } } },
    });

    const valid = await verifyPassword(user?.passwordHash, password);
    if (!user || !user.active || !user.branch.active || !user.branch.business.active || !valid) {
      return NextResponse.json(
        { error: "Geçersiz e-posta veya şifre" },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    });

    await destroySession(response, request);
    await createSession(user, response);

    return response;
  } catch (error) {
    const failure = securityError(error);
    if (failure) return failure;
    return NextResponse.json(
      { error: "Sunucu hatası" },
      { status: 500 }
    );
  }
}
