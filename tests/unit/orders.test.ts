import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

let businessId: string;
let branchId: string;

beforeAll(async () => {
  const business = await prisma.business.create({
    data: { name: "Test", slug: "test-orders" },
  });

  businessId = business.id;

  const branch = await prisma.branch.create({
    data: { businessId: business.id, name: "Test Branch", slug: "test-branch-orders" },
  });

  branchId = branch.id;

  const passwordHash = await argon2.hash("password123");
  await prisma.user.create({
    data: {
      branchId,
      email: "test-orders@test.com",
      passwordHash,
      role: "CASHIER",
    },
  });
});

afterAll(async () => {
  await prisma.order.deleteMany({ where: { branchId } });
  await prisma.user.deleteMany({ where: { branchId } });
  await prisma.branch.deleteMany({ where: { businessId } });
  await prisma.business.deleteMany({ where: { id: businessId } });
  await prisma.$disconnect();
});

describe("Order CRUD", () => {
  it("creates a WAITING order", async () => {
    const order = await prisma.order.create({
      data: {
        branchId,
        orderNumber: "100",
        trackingToken: "token-100",
        status: "WAITING",
      },
    });

    expect(order.status).toBe("WAITING");
    expect(order.orderNumber).toBe("100");
  });

  it("prevents duplicate active order number", async () => {
    await expect(
      prisma.order.create({
        data: {
          branchId,
          orderNumber: "100",
          trackingToken: "token-dup",
          status: "WAITING",
        },
      })
    ).rejects.toThrow();
  });

  it("allows reuse of completed order number", async () => {
    const existing = await prisma.order.findFirst({
      where: { orderNumber: "100", branchId },
    });

    await prisma.order.update({
      where: { id: existing!.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    const newOrder = await prisma.order.create({
      data: {
        branchId,
        orderNumber: "100",
        trackingToken: "token-100-reused",
        status: "WAITING",
      },
    });

    expect(newOrder.status).toBe("WAITING");
  });

  it("finds order by tracking token", async () => {
    const order = await prisma.order.findUnique({
      where: { trackingToken: "token-100-reused" },
      select: { orderNumber: true, status: true },
    });

    expect(order).not.toBeNull();
    expect(order!.orderNumber).toBe("100");
  });

  it("returns null for invalid tracking token", async () => {
    const order = await prisma.order.findUnique({
      where: { trackingToken: "nonexistent" },
    });

    expect(order).toBeNull();
  });
});

describe("Order status transitions", () => {
  it("valid WAITING -> READY", async () => {
    const order = await prisma.order.create({
      data: {
        branchId,
        orderNumber: "200",
        trackingToken: "token-200",
        status: "WAITING",
      },
    });

    const updated = await prisma.order.update({
      where: { id: order.id, status: "WAITING" },
      data: { status: "READY", readyAt: new Date() },
    });
    expect(updated.status).toBe("READY");
  });

  it("valid READY -> COMPLETED", async () => {
    const order = await prisma.order.create({
      data: {
        branchId,
        orderNumber: "201",
        trackingToken: "token-201",
        status: "WAITING",
      },
    });

    await prisma.order.update({
      where: { id: order.id, status: "WAITING" },
      data: { status: "READY", readyAt: new Date() },
    });

    const updated = await prisma.order.update({
      where: { id: order.id, status: "READY" },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    expect(updated.status).toBe("COMPLETED");
  });

  it("completed order has final status", async () => {
    const order = await prisma.order.create({
      data: {
        branchId,
        orderNumber: "202",
        trackingToken: "token-202",
        status: "WAITING",
      },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { status: "READY", readyAt: new Date() },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    const completed = await prisma.order.findUnique({ where: { id: order.id } });
    expect(completed!.status).toBe("COMPLETED");
    expect(completed!.completedAt).not.toBeNull();
  });
});

describe("Active order query", () => {
  it("finds WAITING orders", async () => {
    const order = await prisma.order.create({
      data: {
        branchId,
        orderNumber: "300",
        trackingToken: "token-300",
        status: "WAITING",
      },
    });

    const orders = await prisma.order.findMany({
      where: { branchId, status: { in: ["WAITING", "READY"] } },
    });
    expect(orders.some((o) => o.id === order.id)).toBe(true);
  });

  it("excludes COMPLETED orders from active list", async () => {
    const order = await prisma.order.create({
      data: {
        branchId,
        orderNumber: "301",
        trackingToken: "token-301",
        status: "WAITING",
      },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    const orders = await prisma.order.findMany({
      where: {
        branchId,
        status: { in: ["WAITING", "READY"] },
        orderNumber: "301",
      },
    });
    expect(orders.length).toBe(0);
  });
});
