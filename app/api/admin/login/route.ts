import { NextResponse } from "next/server";
import { adminToken, verifyAdminPassword } from "@/lib/admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const limit = await checkRateLimit(request, "admin-login", 10, 15 * 60);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter);
  const { password } = await request.json();
  if (!process.env.ADMIN_PASSWORD || !(await verifyAdminPassword(String(password || "")))) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set("jd_admin", await adminToken(), {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 60 * 60 * 12,
    path: "/",
  });
  return response;
}
