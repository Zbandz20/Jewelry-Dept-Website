import { createHash } from "crypto";
import { ensureAdminTables, getSql } from "@/lib/admin";

function clientFingerprint(request: Request) {
  const forwarded = request.headers.get("x-vercel-forwarded-for")
    || request.headers.get("x-forwarded-for")
    || request.headers.get("x-real-ip")
    || "unknown";
  const address = forwarded.split(",")[0].trim().slice(0, 100);
  const agent = (request.headers.get("user-agent") || "unknown").slice(0, 200);
  return createHash("sha256").update(`${address}:${agent}`).digest("hex").slice(0, 32);
}

export async function checkRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowSeconds: number,
) {
  await ensureAdminTables();
  const key = `${scope}:${clientFingerprint(request)}`;
  const rows = await getSql()`
    INSERT INTO jd_rate_limits (key, window_start, hits)
    VALUES (${key}, NOW(), 1)
    ON CONFLICT (key) DO UPDATE SET
      window_start = CASE
        WHEN jd_rate_limits.window_start <= NOW() - (${windowSeconds} * INTERVAL '1 second') THEN NOW()
        ELSE jd_rate_limits.window_start
      END,
      hits = CASE
        WHEN jd_rate_limits.window_start <= NOW() - (${windowSeconds} * INTERVAL '1 second') THEN 1
        ELSE jd_rate_limits.hits + 1
      END
    RETURNING hits,
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM (window_start + (${windowSeconds} * INTERVAL '1 second') - NOW()))))::integer AS retry_after
  `;
  const hits = Number(rows[0]?.hits || 1);
  return { allowed: hits <= limit, retryAfter: Number(rows[0]?.retry_after || windowSeconds) };
}

export function rateLimitResponse(retryAfter: number) {
  return Response.json(
    { error: "Too many requests. Please wait and try again." },
    { status: 429, headers: { "Retry-After": String(Math.max(1, retryAfter)) } },
  );
}
