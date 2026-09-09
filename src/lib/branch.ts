import { prisma } from "./prisma";
import { randomBytes } from "node:crypto";

export function createBranchSlug(base: string) {
  const prefix = base.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return `${prefix || "branch"}-${randomBytes(8).toString("hex")}`;
}

export async function findBranchBySlug(slug: string) {
  return prisma.branch.findUnique({
    where: { slug, active: true, business: { active: true } },
    select: { id: true, name: true, slug: true, businessId: true },
  });
}

export async function findBranchById(id: string) {
  return prisma.branch.findUnique({
    where: { id },
    select: { id: true, name: true, slug: true, businessId: true, active: true },
  });
}

export async function getBusinessBranches(businessId: string) {
  return prisma.branch.findMany({
    where: { businessId },
    select: { id: true, name: true, slug: true, active: true },
    orderBy: { createdAt: "asc" },
  });
}
