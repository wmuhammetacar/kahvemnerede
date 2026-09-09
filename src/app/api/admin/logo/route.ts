import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { MAX_LOGO_BYTES, removeLogo, storeLogo } from "@/lib/logos";
import { consumeAuthBudget, readLimitedBody, RequestError, securityError } from "@/lib/security";

export const runtime = "nodejs";

async function updateLogo(request: NextRequest, remove: boolean) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const business = await prisma.business.findFirst({
      where: { active: true, branches: { some: { id: user.branchId } } },
    });
    if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

    let logoUrl: string | null = null;
    if (!remove) {
      await consumeAuthBudget(user.id, "logo-upload");
      const bytes = await readLimitedBody(request, MAX_LOGO_BYTES + 16 * 1024);
      let form: FormData;
      try {
        form = await new Response(Buffer.from(bytes), {
          headers: { "Content-Type": request.headers.get("content-type") || "" },
        }).formData();
      } catch {
        throw new RequestError(400, "Invalid multipart body");
      }
      const file = form.get("logo");
      if (!(file instanceof File)) throw new RequestError(400, "Missing logo file");
      logoUrl = await storeLogo(business.id, new Uint8Array(await file.arrayBuffer()));
    }

    // Compare-and-set prevents concurrent uploads from deleting the winning logo.
    try {
      const changed = await prisma.business.updateMany({
        where: { id: business.id, active: true, logoUrl: business.logoUrl },
        data: { logoUrl, updatedAt: new Date() },
      });
      if (changed.count !== 1) throw new RequestError(409, "Logo changed; retry");
    } catch (error) {
      await removeLogo(logoUrl, business.id);
      throw error;
    }
    await removeLogo(business.logoUrl, business.id);
    await logAudit({
      businessId: business.id,
      actorId: user.id,
      action: remove ? "business.logo_removed" : AUDIT_ACTIONS.BUSINESS_LOGO_UPLOADED,
      targetType: "business",
      targetId: business.id,
    });
    return NextResponse.json({ logoUrl });
  } catch (error) {
    const failure = securityError(error);
    if (failure) return failure;
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return updateLogo(request, false);
}

export async function DELETE(request: NextRequest) {
  return updateLogo(request, true);
}
