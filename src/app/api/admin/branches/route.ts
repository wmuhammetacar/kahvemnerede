import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createBranchSlug, getBusinessBranches } from "@/lib/branch";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const createBranchSchema = z.object({
  name: z.string().min(1, "Şube adı gerekli"),
  slug: z
    .string()
    .min(1, "Slug gerekli")
    .regex(/^[a-z0-9-]+$/, "Slug sadece küçük harf, rakam ve tire içerebilir")
    .optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Yetkiniz yok" },
        { status: 403 }
      );
    }

    const business = await prisma.business.findFirst({
      where: {
        branches: { some: { id: user.branchId } },
      },
      select: { id: true },
    });

    if (!business) {
      return NextResponse.json(
        { error: "İşletme bulunamadı" },
        { status: 404 }
      );
    }

    const branches = await getBusinessBranches(business.id);

    return NextResponse.json({ branches });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Yetkiniz yok" },
        { status: 403 }
      );
    }

    const business = await prisma.business.findFirst({
      where: {
        branches: { some: { id: user.branchId } },
      },
      select: { id: true },
    });

    if (!business) {
      return NextResponse.json(
        { error: "İşletme bulunamadı" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = createBranchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name } = parsed.data;
    const slug = parsed.data.slug ?? createBranchSlug(name);

    // Explicit URLs must be globally available; generated URLs include random entropy.
    const existing = await prisma.branch.findUnique({
      where: { slug },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Bu slug zaten kullanılıyor" },
        { status: 409 }
      );
    }

    const branch = await prisma.branch.create({
      data: {
        businessId: business.id,
        name,
        slug,
      },
      select: { id: true, name: true, slug: true, active: true },
    });

    return NextResponse.json({ branch }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "Bu şube adresi zaten kullanılıyor. Farklı bir slug seçin." }, { status: 409 });
    }
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
