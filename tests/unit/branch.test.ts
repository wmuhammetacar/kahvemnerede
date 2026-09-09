import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { findBranchBySlug, findBranchById, getBusinessBranches } from "@/lib/branch";

const prisma = new PrismaClient();

let businessId: string;
let branchAId: string;
let branchBId: string;

beforeAll(async () => {
  const business = await prisma.business.create({
    data: { name: "Test Business", slug: "test-branch-isolation" },
  });
  businessId = business.id;

  const branchA = await prisma.branch.create({
    data: { businessId, name: "Branch A", slug: "branch-a" },
  });
  branchAId = branchA.id;

  const branchB = await prisma.branch.create({
    data: { businessId, name: "Branch B", slug: "branch-b" },
  });
  branchBId = branchB.id;

  const inactiveBranch = await prisma.branch.create({
    data: { businessId, name: "Inactive", slug: "inactive", active: false },
  });
  // unused but created for testing
  void inactiveBranch;
});

afterAll(async () => {
  await prisma.order.deleteMany({ where: { branchId: { in: [branchAId, branchBId] } } });
  await prisma.user.deleteMany({ where: { branchId: { in: [branchAId, branchBId] } } });
  await prisma.branch.deleteMany({ where: { businessId } });
  await prisma.business.deleteMany({ where: { id: businessId } });
  await prisma.$disconnect();
});

describe("Branch Helpers", () => {
  it("findBranchBySlug returns active branch", async () => {
    const branch = await findBranchBySlug("branch-a");
    expect(branch).not.toBeNull();
    expect(branch!.id).toBe(branchAId);
    expect(branch!.name).toBe("Branch A");
  });

  it("findBranchBySlug returns null for inactive branch", async () => {
    const branch = await findBranchBySlug("inactive");
    expect(branch).toBeNull();
  });

  it("findBranchBySlug returns null for non-existent slug", async () => {
    const branch = await findBranchBySlug("non-existent");
    expect(branch).toBeNull();
  });

  it("findBranchById returns branch", async () => {
    const branch = await findBranchById(branchAId);
    expect(branch).not.toBeNull();
    expect(branch!.slug).toBe("branch-a");
    expect(branch!.active).toBe(true);
  });

  it("findBranchById returns null for non-existent id", async () => {
    const branch = await findBranchById("non-existent-id");
    expect(branch).toBeNull();
  });

  it("getBusinessBranches returns all branches for business", async () => {
    const branches = await getBusinessBranches(businessId);
    expect(branches.length).toBe(3); // A, B, inactive
    const slugs = branches.map((b) => b.slug).sort();
    expect(slugs).toEqual(["branch-a", "branch-b", "inactive"]);
  });
});

describe("Cross-Tenant Order Isolation", () => {
  it("orders from different branches are isolated", async () => {
    const orderA = await prisma.order.create({
      data: {
        branchId: branchAId,
        orderNumber: "CROSS1",
        trackingToken: "token-a-isolation-test",
        status: "WAITING",
      },
    });

    const orderB = await prisma.order.create({
      data: {
        branchId: branchBId,
        orderNumber: "CROSS1",
        trackingToken: "token-b-isolation-test",
        status: "WAITING",
      },
    });

    // Same order number, different branches, both should exist
    const branchAOrders = await prisma.order.findMany({
      where: { branchId: branchAId, orderNumber: "CROSS1" },
    });
    expect(branchAOrders.length).toBe(1);
    expect(branchAOrders[0].id).toBe(orderA.id);

    const branchBOrders = await prisma.order.findMany({
      where: { branchId: branchBId, orderNumber: "CROSS1" },
    });
    expect(branchBOrders.length).toBe(1);
    expect(branchBOrders[0].id).toBe(orderB.id);

    // Tracking tokens are unique globally
    const tokenLookup = await prisma.order.findUnique({
      where: { trackingToken: "token-a-isolation-test" },
    });
    expect(tokenLookup).not.toBeNull();
    expect(tokenLookup!.branchId).toBe(branchAId);

    // Cleanup
    await prisma.order.deleteMany({
      where: { id: { in: [orderA.id, orderB.id] } },
    });
  });

  it("active_order_unique constraint prevents duplicate active orders per branch", async () => {
    await prisma.order.create({
      data: {
        branchId: branchAId,
        orderNumber: "DUP1",
        trackingToken: "token-dup-a",
        status: "WAITING",
      },
    });

    // Same branch, same number, same status = should fail
    await expect(
      prisma.order.create({
        data: {
          branchId: branchAId,
          orderNumber: "DUP1",
          trackingToken: "token-dup-a2",
          status: "WAITING",
        },
      })
    ).rejects.toThrow();

    // Different branch, same number, same status = should succeed
    const otherBranchOrder = await prisma.order.create({
      data: {
        branchId: branchBId,
        orderNumber: "DUP1",
        trackingToken: "token-dup-b",
        status: "WAITING",
      },
    });

    expect(otherBranchOrder.branchId).toBe(branchBId);

    // Cleanup
    await prisma.order.deleteMany({
      where: { orderNumber: "DUP1" },
    });
  });
});
