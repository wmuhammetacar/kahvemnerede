import { NextResponse } from "next/server";
import { clearSessionCookie, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const user = await getCurrentUser(request, { allowPasswordChange: true });

  if (!user) {
    const response = NextResponse.json({ user: null }, { status: 401, headers: { "Cache-Control": "no-store" } });
    clearSessionCookie(response);
    return response;
  }

  const branch = await prisma.branch.findUnique({
    where: { id: user.branchId },
    select: {
      slug: true,
      name: true,
      business: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          primaryColor: true,
          trackingTitle: true,
          readyMessage: true,
        },
      },
    },
  });

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      branchId: user.branchId,
      branchSlug: branch?.slug || null,
      branchName: branch?.name || null,
      mustChangePassword: user.mustChangePassword,
      business: branch?.business || null,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
