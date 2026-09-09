import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { isSameOrigin } from "./security";
import type { User } from "@prisma/client";

const SESSION_COOKIE = "session";
const SESSION_SECONDS = 60 * 60 * 24;
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_SECONDS,
};

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function getSessionToken(request?: Request): Promise<string | undefined> {
  if (!request) return (await cookies()).get(SESSION_COOKIE)?.value;
  return request.headers.get("cookie")?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
}

// Streams must revalidate the original token, not just the user's active flag.
export async function validateSession(
  token: string | undefined,
  options: { allowPasswordChange?: boolean } = {},
): Promise<User | null> {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { user: { include: { branch: { include: { business: true } } } } },
  });
  if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) return null;
  const { user } = session;
  if (!user.active || !user.branch.active || !user.branch.business.active ||
      user.updatedAt.getTime() !== session.userUpdatedAt.getTime() ||
      (user.mustChangePassword && !options.allowPasswordChange)) return null;
  return user;
}

export async function createSession(user: Pick<User, "id" | "updatedAt">, response: NextResponse) {
  const token = randomBytes(32).toString("hex");
  await prisma.session.create({
    data: {
      tokenHash: tokenHash(token),
      userId: user.id,
      userUpdatedAt: user.updatedAt,
      expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000),
    },
  });
  response.cookies.set(SESSION_COOKIE, token, COOKIE_OPTS);
  response.headers.set("Cache-Control", "no-store");
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", { ...COOKIE_OPTS, maxAge: 0 });
}

export async function destroySession(response: NextResponse, request?: Request) {
  const token = await getSessionToken(request);
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    await prisma.session.updateMany({
      where: { tokenHash: tokenHash(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  clearSessionCookie(response);
}

export async function getCurrentUser(
  request?: Request,
  options: { allowPasswordChange?: boolean } = {},
): Promise<User | null> {
  return validateSession(await getSessionToken(request), options);
}

export async function requireAuth(
  request?: Request,
  options: { allowPasswordChange?: boolean } = {},
): Promise<User> {
  if (request && !["GET", "HEAD", "OPTIONS"].includes(request.method) && !isSameOrigin(request)) {
    throw new Error("UNAUTHORIZED");
  }
  const user = await getCurrentUser(request, options);
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}
