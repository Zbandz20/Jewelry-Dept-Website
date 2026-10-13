import { ensureAdminTables, getSql } from "@/lib/admin";

export const runtime = "nodejs";

const IMAGE_PATTERN = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/;
const MAX_DATA_URL_LENGTH = 4_000_000;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  if (!/^[a-z0-9_-]{1,50}$/i.test(id)) return new Response("Not found", { status: 404 });

  await ensureAdminTables();
  const rows = await getSql()`SELECT data_url FROM jd_assets WHERE id = ${id} LIMIT 1`;
  const dataUrl = String(rows[0]?.data_url || "");
  if (!dataUrl || dataUrl.length > MAX_DATA_URL_LENGTH) return new Response("Not found", { status: 404 });

  const match = dataUrl.match(IMAGE_PATTERN);
  if (!match) return new Response("Not found", { status: 404 });

  const bytes = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!bytes.length) return new Response("Not found", { status: 404 });

  return new Response(bytes, {
    headers: {
      "Content-Type": match[1],
      "Content-Length": String(bytes.length),
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
