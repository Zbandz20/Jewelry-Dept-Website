import { ensureAdminTables, getSql } from "@/lib/admin";

export const runtime = "nodejs";

const IMAGE_PATTERN = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/;
const MAX_DATA_URL_LENGTH = 4_000_000;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return new Response("Not found", { status: 404 });

  await ensureAdminTables();
  const rows = await getSql()`SELECT image_url FROM jd_products WHERE id = ${id} AND active = TRUE LIMIT 1`;
  const imageUrl = String(rows[0]?.image_url || "");
  if (!imageUrl || imageUrl.length > MAX_DATA_URL_LENGTH) return new Response("Not found", { status: 404 });

  const match = imageUrl.match(IMAGE_PATTERN);
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
