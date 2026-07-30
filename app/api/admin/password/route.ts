import { NextResponse } from "next/server";
import { adminToken, isAdmin, setAdminPassword } from "@/lib/admin";

export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { newPassword } = await request.json();
  if (String(newPassword || "").length < 10) {
    return NextResponse.json({ error: "Use at least 10 characters." }, { status: 400 });
  }
  await setAdminPassword(String(newPassword));
  const response = NextResponse.json({ ok: true });
  response.cookies.set("jd_admin", await adminToken(), {
    httpOnly: true, secure: true, sameSite: "strict", maxAge: 60 * 60 * 12, path: "/",
  });
  return response;
}
