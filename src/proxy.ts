import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, getCurrentUser } from "@/lib/auth";
import { isSameOrigin } from "@/lib/security";
import { validateProductionEnv } from "@/lib/env";

export async function proxy(request: NextRequest) {
  validateProductionEnv();

  const { pathname } = request.nextUrl;
  // Legacy uploads were stored verbatim with attacker-controlled extensions.
  if (pathname === "/uploads/logos" || pathname.startsWith("/uploads/logos/")) {
    return new NextResponse(null, { status: 404 });
  }
  if (pathname.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
      !isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const panel = pathname === "/panel" || pathname.startsWith("/panel/");
  const passwordPage = pathname === "/change-password";
  const protectedApi = ["/api/admin", "/api/orders", "/api/history", "/api/reports", "/api/events/orders"]
    .some((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (!panel && !passwordPage && !protectedApi && pathname !== "/login") return NextResponse.next();

  const user = await getCurrentUser(request, { allowPasswordChange: true });
  if (!user) {
    const response = protectedApi
      ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      : panel || passwordPage ? NextResponse.redirect(new URL("/login", request.url)) : NextResponse.next();
    if (request.cookies.has("session")) clearSessionCookie(response);
    return response;
  }
  if (user.mustChangePassword && protectedApi) {
    return NextResponse.json({ error: "Password change required", code: "PASSWORD_CHANGE_REQUIRED" }, { status: 403 });
  }
  if (user.mustChangePassword && (panel || pathname === "/login")) {
    return NextResponse.redirect(new URL("/change-password", request.url));
  }
  if (pathname === "/login") {
    return NextResponse.redirect(new URL("/panel", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
