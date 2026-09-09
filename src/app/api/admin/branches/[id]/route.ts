import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";

const updateBranchSchema = z.object({
  name: z.string().min(1, "Şube adı gerekli").optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Yetkiniz yok" },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Verify branch belongs to user's business
    const branch = await prisma.branch.findFirst({
      where: {
        id,
        business: {
          branches: { some: { id: user.branchId } },
        },
      },
      select: { id: true, businessId: true },
    });

    if (!branch) {
      return NextResponse.json(
        { error: "Şube bulunamadı" },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Slug immutability: reject any attempt to change slug via API.
    if ("slug" in body && body.slug !== undefined) {
      return NextResponse.json(
        { error: "Branch slug oluşturulduktan sonra değiştirilemez. Yeni şube oluşturun." },
        { status: 409 }
      );
    }

    const parsed = updateBranchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const updated = await prisma.branch.update({
      where: { id },
      data,
      select: { id: true, name: true, slug: true, active: true },
    });

    return NextResponse.json({ branch: updated });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
