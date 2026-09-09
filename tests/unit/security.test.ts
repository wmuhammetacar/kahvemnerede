import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const db = vi.hoisted(() => ({
  session: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  loginAttempt: { upsert: vi.fn() },
  user: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  branch: { findUnique: vi.fn(), findFirst: vi.fn() },
  business: { findFirst: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
}));
const passwords = vi.hoisted(() => ({ verify: vi.fn(), hash: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("argon2", () => ({ default: passwords }));

import { createSession, destroySession, getCurrentUser, requireAuth, validateSession } from "@/lib/auth";
import { consumeAuthBudget, isSameOrigin, readJson, readLimitedBody } from "@/lib/security";
import { verifyPassword } from "@/lib/passwords";
import { businessSettingsSchema, changePasswordSchema, loginSchema, staffCreateSchema, staffUpdateSchema } from "@/lib/validations";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as changePassword } from "@/app/api/auth/change-password/route";
import { GET as me } from "@/app/api/auth/me/route";
import { PATCH as updateStaff } from "@/app/api/admin/staff/[id]/route";
import { proxy } from "@/proxy";

const token = "a".repeat(64);
const timestamp = new Date("2026-01-01T00:00:00Z");
function session() {
  return {
    userUpdatedAt: timestamp,
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null as Date | null,
    user: {
      id: "user1", email: "user@example.com", role: "ADMIN", branchId: "branch1",
      updatedAt: timestamp, createdAt: timestamp, active: true, mustChangePassword: false,
      passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$c2FsdA$aGFzaA",
      branch: { active: true, business: { active: true } },
    },
  };
}
function request(path: string, body?: unknown, origin = "https://coffee.test") {
  return new NextRequest(`https://coffee.test${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { cookie: `session=${token}`, origin, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_ORIGIN", "https://coffee.test");
  db.session.findUnique.mockResolvedValue(session());
  db.session.create.mockResolvedValue({});
  db.session.updateMany.mockResolvedValue({ count: 1 });
  db.loginAttempt.upsert.mockResolvedValue({ count: 1 });
  db.user.findUnique.mockResolvedValue(session().user);
  db.branch.findUnique.mockResolvedValue(null);
  db.$transaction.mockImplementation((fn) => fn(db));
  passwords.verify.mockResolvedValue(true);
  passwords.hash.mockResolvedValue("new-hash");
});

describe("opaque sessions", () => {
  it("rejects raw user IDs and malformed tokens without querying DB", async () => {
    for (const value of [undefined, "user1", "a".repeat(63), `${token}%00`]) {
      expect(await validateSession(value)).toBeNull();
    }
    expect(db.session.findUnique).not.toHaveBeenCalled();
  });

  it("stores only a hash, issues distinct secure random cookies", async () => {
    const first = NextResponse.json({});
    const second = NextResponse.json({});
    await createSession(session().user, first);
    await createSession(session().user, second);
    const value = first.cookies.get("session")!.value;
    expect(value).toMatch(/^[a-f0-9]{64}$/);
    expect(value).not.toBe(second.cookies.get("session")!.value);
    expect(db.session.create.mock.calls[0][0].data).toMatchObject({
      tokenHash: createHash("sha256").update(value).digest("hex"),
      userId: "user1", userUpdatedAt: timestamp,
    });
    expect(JSON.stringify(db.session.create.mock.calls)).not.toContain(value);
    expect(first.headers.get("set-cookie")).toContain("HttpOnly");
    expect(first.headers.get("set-cookie")).toContain("SameSite=lax");
  });

  it.each(["expired", "revoked", "user", "branch", "business", "version", "forced"])("rejects %s sessions", async (reason) => {
    const value = session();
    if (reason === "expired") value.expiresAt = new Date(0);
    if (reason === "revoked") value.revokedAt = new Date();
    if (reason === "user") value.user.active = false;
    if (reason === "branch") value.user.branch.active = false;
    if (reason === "business") value.user.branch.business.active = false;
    if (reason === "version") value.user.updatedAt = new Date(timestamp.getTime() + 1);
    if (reason === "forced") value.user.mustChangePassword = true;
    db.session.findUnique.mockResolvedValue(value);
    expect(await getCurrentUser(request("/api/orders"))).toBeNull();
    await expect(requireAuth(request("/api/orders"))).rejects.toThrow("UNAUTHORIZED");
  });

  it("allows restricted identity but not normal auth", async () => {
    const value = session();
    value.user.mustChangePassword = true;
    db.session.findUnique.mockResolvedValue(value);
    expect(await validateSession(token, { allowPasswordChange: true })).toEqual(value.user);
    const response = await me(request("/api/auth/me"));
    expect(response.status).toBe(200);
    expect((await response.json()).user.mustChangePassword).toBe(true);
  });

  it("revokes server session on logout and expires cookie", async () => {
    const response = NextResponse.json({});
    await destroySession(response, request("/api/auth/logout", {}));
    expect(db.session.updateMany).toHaveBeenCalledWith({
      where: { tokenHash: createHash("sha256").update(token).digest("hex"), revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("clears invalid cookies without redirecting login back to panel", async () => {
    db.session.findUnique.mockResolvedValue(null);
    const response = await proxy(request("/login"));
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect((await me(request("/api/auth/me"))).status).toBe(401);
  });

  it("centrally blocks restricted APIs and redirects pages to password change", async () => {
    const value = session();
    value.user.mustChangePassword = true;
    db.session.findUnique.mockResolvedValue(value);
    expect((await proxy(request("/api/orders"))).status).toBe(403);
    expect((await proxy(request("/panel"))).headers.get("location")).toBe("https://coffee.test/change-password");
  });

  it("blocks legacy verbatim uploads instead of serving executable extensions", async () => {
    expect((await proxy(request("/uploads/logos/old.html"))).status).toBe(404);
    expect(db.session.findUnique).not.toHaveBeenCalled();
  });
});

describe("CSRF, bounded work and shared throttling", () => {
  it("rejects absent, null, cross-origin and cross-site origins", async () => {
    for (const origin of ["", "null", "https://evil.test"]) {
      const req = request("/api/auth/login", { email: "user@example.com", password: "Password1" }, origin);
      expect(isSameOrigin(req)).toBe(false);
      expect((await login(req)).status).toBe(403);
    }
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(isSameOrigin(new Request("https://coffee.test", { headers: { origin: "https://coffee.test", "sec-fetch-site": "cross-site" } }))).toBe(false);
    expect(isSameOrigin(request("/api/auth/login", {}))).toBe(true);
  });

  it("limits streamed bodies without trusting Content-Length", async () => {
    await expect(readLimitedBody(new Request("https://coffee.test", { method: "POST", body: "12345" }), 4)).rejects.toMatchObject({ status: 413 });
    await expect(readJson(new Request("https://coffee.test", { method: "POST", body: "{" }))).rejects.toMatchObject({ status: 400 });
  });

  it("atomically increments shared hashed account and global buckets", async () => {
    await consumeAuthBudget("User@Example.com");
    expect(db.loginAttempt.upsert).toHaveBeenCalledTimes(2);
    const calls = db.loginAttempt.upsert.mock.calls;
    expect(calls[0][0].update).toEqual({ count: { increment: 1 } });
    expect(calls[1][0].where.key).toContain(createHash("sha256").update("user@example.com").digest("hex"));
    expect(JSON.stringify(calls)).not.toContain("User@Example.com");
  });

  it("rejects over-budget logins before password verification", async () => {
    db.loginAttempt.upsert.mockResolvedValue({ count: 101 });
    const response = await login(request("/api/auth/login", { email: "user@example.com", password: "Password1" }));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("900");
    expect(passwords.verify).not.toHaveBeenCalled();
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it("fails closed when the shared limiter is unavailable", async () => {
    db.loginAttempt.upsert.mockRejectedValue(new Error("DB unavailable"));
    expect((await login(request("/api/auth/login", { email: "user@example.com", password: "Password1" }))).status).toBe(500);
    expect(passwords.verify).not.toHaveBeenCalled();
  });

  it("does dummy verification for unknown users but never logs them in", async () => {
    db.user.findUnique.mockResolvedValue(null);
    expect((await login(request("/api/auth/login", { email: "unknown@example.com", password: "Password1" }))).status).toBe(401);
    expect(passwords.verify).toHaveBeenCalledTimes(1);
    expect(db.session.create).not.toHaveBeenCalled();
  });

  it("does not issue sessions for inactive businesses", async () => {
    const value = session().user;
    value.branch.business.active = false;
    db.user.findUnique.mockResolvedValue(value);
    expect((await login(request("/api/auth/login", { email: value.email, password: "Password1" }))).status).toBe(401);
    expect(db.session.create).not.toHaveBeenCalled();
  });

  it("rejects oversized passwords and excessive encoded Argon2 costs", async () => {
    expect(await verifyPassword(session().user.passwordHash, "x".repeat(129))).toBe(false);
    expect(await verifyPassword(session().user.passwordHash.replace("m=65536", "m=9999999"), "Password1")).toBe(false);
    expect(passwords.verify).not.toHaveBeenCalled();
    expect(loginSchema.safeParse({ email: "user@example.com", password: "x".repeat(129) }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ currentPassword: "old", newPassword: `Aa1${"x".repeat(129)}` }).success).toBe(false);
    expect(staffCreateSchema.safeParse({ email: "user@example.com", password: `Aa1${"x".repeat(129)}`, role: "ADMIN", branchId: "branch1" }).success).toBe(false);
  });

  it("rejects arbitrary logo URLs and empty staff updates", () => {
    expect(businessSettingsSchema.safeParse({ logoUrl: "/../../secret" }).success).toBe(false);
    expect(staffUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("changes forced passwords, atomically revokes all sessions and rotates the current token", async () => {
    const value = session();
    value.user.mustChangePassword = true;
    db.session.findUnique.mockResolvedValue(value);
    db.user.update.mockResolvedValue({ ...value.user, mustChangePassword: false, updatedAt: new Date() });
    const response = await changePassword(request("/api/auth/change-password", { currentPassword: "OldPassword1", newPassword: "NewPassword2" }));
    expect(response.status).toBe(200);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.user.update.mock.calls[0][0].where.updatedAt).toEqual(timestamp);
    expect(db.session.updateMany.mock.calls[0][0].where).toEqual({ userId: "user1", revokedAt: null });
    expect(response.cookies.get("session")!.value).not.toBe(token);
  });

  it.each([{ active: false }, { branchId: "branch2" }, { role: "CASHIER" }])("revokes all staff sessions after %j", async (body) => {
    const target = { ...session().user, id: "staff1" };
    db.business.findFirst.mockResolvedValue({ id: "business1" });
    db.user.findFirst.mockResolvedValue(target);
    db.branch.findFirst.mockResolvedValue({ id: "branch2" });
    db.user.update.mockResolvedValue({ ...target, ...body });
    const req = new NextRequest("https://coffee.test/api/admin/staff/staff1", {
      method: "PATCH",
      headers: { cookie: `session=${token}`, origin: "https://coffee.test", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const response = await updateStaff(req, { params: Promise.resolve({ id: "staff1" }) });
    expect(response.status).toBe(200);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.user.update.mock.calls[0][0].where).toEqual({
      id: "staff1", updatedAt: timestamp, branch: { businessId: "business1" },
    });
    expect(db.session.updateMany.mock.calls[0][0].where).toEqual({ userId: "staff1", revokedAt: null });
  });
});
