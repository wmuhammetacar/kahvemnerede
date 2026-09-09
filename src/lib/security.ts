import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin || request.headers.get("sec-fetch-site") === "cross-site") return false;
  try {
    return origin === new URL(process.env.APP_ORIGIN || request.url).origin;
  } catch {
    return false;
  }
}

export class RequestError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function securityError(error: unknown): NextResponse | undefined {
  if (error instanceof RequestError) {
    return NextResponse.json({ error: error.message }, {
      status: error.status,
      headers: error.status === 429 ? { "Retry-After": "900" } : undefined,
    });
  }
}

export async function readLimitedBody(request: Request, maxBytes: number): Promise<Uint8Array> {
  if (Number(request.headers.get("content-length")) > maxBytes) {
    throw new RequestError(413, "Request too large");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError(400, "Missing body");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        throw new RequestError(413, "Request too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, length);
}

export async function readJson(request: Request): Promise<unknown> {
  const body = await readLimitedBody(request, 16 * 1024);
  try {
    return JSON.parse(new TextDecoder().decode(body));
  } catch {
    throw new RequestError(400, "Invalid JSON");
  }
}

// Public lookup rate limit — separate from login budget.
// scope="track" prevents order-number enumeration brute-force.
export async function consumePublicLookupBudget(ip: string, branchSlug: string) {
  const globalKey = `track:global:${ip}`;
  const branchKey = `track:branch:${branchSlug}:${ip}`;
  for (const [key, seconds, limit] of [
    [globalKey, 60, 30],
    [branchKey, 60, 15],
  ] as const) {
    const window = Math.floor(Date.now() / (seconds * 1000));
    const attempt = await prisma.loginAttempt.upsert({
      where: { key: `${key}:${window}` },
      create: {
        key: `${key}:${window}`,
        count: 1,
        expiresAt: new Date((window + 1) * seconds * 1000),
      },
      update: { count: { increment: 1 } },
    });
    if (attempt.count > limit) {
      const retryAfter = Math.ceil(
        (attempt.expiresAt.getTime() - Date.now()) / 1000
      );
      throw new RequestError(
        429,
        `Çok fazla deneme yapıldı. Lütfen ${retryAfter} saniye sonra tekrar deneyin.`
      );
    }
  }
}

// Atomic shared counters: no process-local limit or spoofable forwarding header.
export async function consumeAuthBudget(subject: string, scope = "login") {
  for (const [key, seconds, limit] of [
    ["global", 60, 100],
    [createHash("sha256").update(subject.trim().toLowerCase()).digest("hex"), 900, 10],
  ] as const) {
    const window = Math.floor(Date.now() / (seconds * 1000));
    const attempt = await prisma.loginAttempt.upsert({
      where: { key: `${scope}:${key}:${window}` },
      create: {
        key: `${scope}:${key}:${window}`,
        count: 1,
        expiresAt: new Date((window + 1) * seconds * 1000),
      },
      update: { count: { increment: 1 } },
    });
    if (attempt.count > limit) throw new RequestError(429, "Too many attempts. Try again later.");
  }
}
