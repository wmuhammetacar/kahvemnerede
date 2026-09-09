import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { logoPath } from "@/lib/logos";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  const filepath = logoPath(filename);
  if (!filepath) return new Response(null, { status: 404 });
  const business = await prisma.business.findFirst({
    where: { active: true, logoUrl: `/api/uploads/logos/${filename}` },
    select: { id: true },
  });
  if (!business) return new Response(null, { status: 404 });
  try {
    const file = await open(filepath, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      return new Response(new Uint8Array(await file.readFile()), {
        headers: {
          "Content-Type": "image/png",
          "Content-Disposition": "inline",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'; sandbox",
          "Cache-Control": "public, max-age=300",
        },
      });
    } finally {
      await file.close();
    }
  } catch (error) {
    if (["ENOENT", "ELOOP"].includes((error as NodeJS.ErrnoException).code || "")) {
      return new Response(null, { status: 404 });
    }
    throw error;
  }
}
