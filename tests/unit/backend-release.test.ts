import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { readFileSync } from "node:fs";

const mocks = vi.hoisted(() => ({
  db: {
    order: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    branch: { findUnique: vi.fn(), findFirst: vi.fn() },
    business: { findFirst: vi.fn() },
    loginAttempt: { upsert: vi.fn().mockResolvedValue({ count: 1, expiresAt: new Date(Date.now() + 60000) }) },
  },
  auth: vi.fn(), publish: vi.fn(),
  summary: vi.fn(), hourly: vi.fn(), daily: vi.fn(), comparison: vi.fn(), exportData: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.db }));
vi.mock("@/lib/auth", () => ({ requireAuth: mocks.auth }));
vi.mock("@/lib/events", () => ({ eventBus: { publish: mocks.publish } }));
vi.mock("@/lib/reports-query", () => ({
  getSummary: mocks.summary, getHourlyDistribution: mocks.hourly,
  getDailyDistribution: mocks.daily, getBranchComparison: mocks.comparison, getExportData: mocks.exportData,
}));
import { PATCH as ready } from "@/app/api/orders/[id]/ready/route";
import { PATCH as complete } from "@/app/api/orders/[id]/complete/route";
import { PATCH as undo } from "@/app/api/orders/[id]/undo-ready/route";
import { GET as active, POST as create } from "@/app/api/orders/route";
import { GET as history } from "@/app/api/history/route";
import { GET as publicOrders } from "@/app/api/b/[slug]/orders/route";
import { GET as token } from "@/app/api/track/[token]/route";
import { POST as unscopedTrack } from "@/app/api/track/route";
import { createBranchSlug, findBranchBySlug } from "@/lib/branch";
import { GET as summary } from "@/app/api/reports/summary/route";
import { GET as exportReport } from "@/app/api/reports/export/route";
import { GET as branding } from "@/app/api/public/branding/[slug]/route";

const request = (path = "/api/orders") => new NextRequest(`http://localhost${path}`);
const params = { params: Promise.resolve({ id: "order" }) };
const conflict = () => new Prisma.PrismaClientKnownRequestError("conflict", { code: "P2025", clientVersion: "6" });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ branchId: "own", role: "ADMIN" });
  mocks.db.order.findFirst.mockResolvedValue({ id: "order", trackingToken: "secret", orderNumber: "100" });
  mocks.db.order.findMany.mockResolvedValue([]);
  mocks.db.branch.findUnique.mockResolvedValue({ id: "own", businessId: "business", timezone: "Europe/Istanbul" });
  mocks.db.business.findFirst.mockResolvedValue({ id: "business" });
  mocks.db.loginAttempt.upsert.mockResolvedValue({ count: 1, expiresAt: new Date(Date.now() + 60000) });
});
afterEach(() => vi.useRealTimers());

describe("atomic lifecycle", () => {
  it.each([[ready, "WAITING"], [complete, "READY"], [undo, "READY"]] as const)("guards transition with expected state", async (handler, status) => {
    mocks.db.order.update.mockRejectedValue(conflict());
    expect((await handler(request(), params)).status).toBe(409);
    expect(mocks.db.order.update.mock.calls[0][0].where).toMatchObject({ id: "order", branchId: "own", status });
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("enforces the eight-second undo deadline in the update predicate", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-09-08T12:00:00Z"));
    mocks.db.order.update.mockRejectedValue(conflict());
    expect((await undo(request(), params)).status).toBe(409);
    expect(mocks.db.order.update.mock.calls[0][0].where.readyAt).toEqual({ gte: new Date("2026-09-08T11:59:52Z"), lte: new Date("2026-09-08T12:00:00Z") });
  });

  it("allows repeated completed lifecycles without stale-state overwrites", async () => {
    for (let cycle = 0; cycle < 3; cycle++) {
      let state = "WAITING";
      mocks.db.order.update.mockImplementation(async ({ where, data }) => {
        if (where.status !== state) throw conflict();
        state = data.status;
        return { id: "order", orderNumber: "100", createdAt: new Date(), ...data };
      });
      expect((await ready(request(), params)).status).toBe(200);
      expect((await complete(request(), params)).status).toBe(200);
      expect((await ready(request(), params)).status).toBe(409);
      expect((await complete(request(), params)).status).toBe(409);
      expect(state).toBe("COMPLETED");
    }
  });

  it("maps concurrent duplicate creation to a meaningful conflict", async () => {
    mocks.db.order.findFirst.mockResolvedValue(null);
    mocks.db.order.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "6" }));
    const response = await create(new NextRequest("http://localhost/api/orders", { method: "POST", body: JSON.stringify({ orderNumber: "100" }) }));
    expect(response.status).toBe(409);
  });

  it("migration restricts uniqueness only to active orders and rejects ambiguous URLs", () => {
    const sql = readFileSync(new URL("../../prisma/migrations/20260908120000_backend_release_constraints/migration.sql", import.meta.url), "utf8");
    expect(sql).toContain('ON "Order"("branchId", "orderNumber")\n  WHERE "status" IN (\'WAITING\', \'READY\')');
    expect(sql).toContain("Duplicate branch slugs exist");
    expect(sql).toContain('DROP INDEX "Order_branchId_orderNumber_status_key"');
    expect(sql).not.toMatch(/UPDATE\s+"Branch"/);
  });
});

describe("tenant and public boundaries", () => {
  it.each([
    { active: false, business: { active: true } },
    { active: true, business: { active: false } },
  ])("hides disabled branch or business branding", async (branch) => {
    mocks.db.branch.findUnique.mockResolvedValue(branch);
    expect((await branding(request(), { params: Promise.resolve({ slug: "coffee" }) })).status).toBe(404);
  });

  it("resolves only a globally unique active branch in an active business", async () => {
    await findBranchBySlug("coffee");
    expect(mocks.db.branch.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { slug: "coffee", active: true, business: { active: true } } }));
    expect(createBranchSlug("Coffee")).toMatch(/^coffee-[a-f0-9]{16}$/);
    expect(createBranchSlug("Coffee")).not.toBe(createBranchSlug("Coffee"));
  });

  it("exposes only READY public projections regardless of requested status", async () => {
    await publicOrders(request("/api/b/coffee/orders?status=COMPLETED"), { params: Promise.resolve({ slug: "coffee" }) });
    expect(mocks.db.order.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { branchId: "own", status: "READY" }, select: { orderNumber: true, status: true, readyAt: true } }));
  });

  it("retires global number lookup without querying orders", async () => {
    expect((await unscopedTrack()).status).toBe(410);
    expect(mocks.db.order.findFirst).not.toHaveBeenCalled();
  });

  it("token lookup checks active branch and business", async () => {
    await token(request(), { params: Promise.resolve({ token: "secret" }) });
    expect(mocks.db.order.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { trackingToken: "secret", branch: { active: true, business: { active: true } } } }));
  });

  it("operational list never includes completed orders", async () => {
    await active(request());
    expect(mocks.db.order.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { branchId: "own", status: { in: ["WAITING", "READY"] } } }));
    expect((await active(request("/api/orders?status=COMPLETED"))).status).toBe(400);
  });

  it("admin all-branches history stays in their business and paginates", async () => {
    mocks.db.order.findMany.mockResolvedValue([{ id: "1" }, { id: "2" }, { id: "3" }]);
    const response = await history(request("/api/history?branchId=all&page=2&pageSize=2"));
    expect(mocks.db.order.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: "COMPLETED", branch: { businessId: "business" } }, skip: 2, take: 3 }));
    expect(await response.json()).toMatchObject({ orders: [{ id: "1" }, { id: "2" }], hasMore: true });
  });

  it("rejects foreign branch selection rather than silently falling back", async () => {
    mocks.db.branch.findFirst.mockResolvedValue(null);
    expect((await history(request("/api/history?branchId=foreign"))).status).toBe(404);
    expect(mocks.db.order.findMany).not.toHaveBeenCalled();
  });

  it("cashiers cannot select all branches", async () => {
    mocks.auth.mockResolvedValue({ branchId: "own", role: "CASHIER" });
    expect((await history(request("/api/history?branchId=all"))).status).toBe(403);
  });

  it.each(["page=0", "pageSize=101", "date=2026-02-30"])("rejects invalid history input %s", async (query) => {
    expect((await history(request(`/api/history?${query}`))).status).toBe(400);
    expect(mocks.db.order.findMany).not.toHaveBeenCalled();
  });
});

describe("selected branch reports", () => {
  it.each([summary, exportReport])("uses selected branch timezone for bounds", async (handler) => {
    vi.useFakeTimers().setSystemTime(new Date("2026-09-08T12:00:00Z"));
    mocks.db.branch.findFirst.mockResolvedValue({ id: "selected", timezone: "Asia/Tokyo" });
    mocks.exportData.mockResolvedValue([]);
    const response = await handler(request("/api/reports/summary?branchId=selected&range=today"));
    expect(response.status).toBe(200);
    expect(mocks.db.branch.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "selected", businessId: "business" } }));
    const call = handler === summary ? mocks.summary.mock.calls[0] : mocks.exportData.mock.calls[0];
    expect(call).toEqual([["selected"], new Date("2026-09-07T15:00:00Z"), new Date("2026-09-08T12:00:00Z")]);
    if (handler === summary) expect(mocks.hourly.mock.calls[0][3]).toBe("Asia/Tokyo");
  });

  it.each([summary, exportReport])("rejects invalid report ranges", async (handler) => {
    mocks.db.branch.findFirst.mockResolvedValue({ id: "selected", timezone: "UTC" });
    expect((await handler(request("/api/reports/summary?branchId=selected&range=invalid"))).status).toBe(400);
    expect(mocks.summary).not.toHaveBeenCalled();
    expect(mocks.exportData).not.toHaveBeenCalled();
  });
});
