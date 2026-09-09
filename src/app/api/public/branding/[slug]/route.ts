import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { consumePublicLookupBudget, securityError } from "@/lib/security";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    await consumePublicLookupBudget(ip, "branding");

    const { slug } = await params;

    const branch = await prisma.branch.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        active: true,
        business: {
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
        },
      },
    });

    if (!branch || !branch.active || !branch.business.active) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      branch: {
        id: branch.id,
        name: branch.name,
        active: branch.active,
      },
      business: branch.business,
    });
  } catch (e) {
    const securityResponse = securityError(e);
    if (securityResponse) return securityResponse;
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
