import { ensureAdminTables, getSql } from "@/lib/admin";

export const dynamic = "force-dynamic";

const TROY_OUNCE_GRAMS = 31.1034768;
const PURITY: Record<string, number> = { "10K": 10 / 24, "14K": 14 / 24, "18K": 18 / 24, "24K": 1 };
const CRAFT: Record<string, { label: string; perGram: number; minimum: number }> = {
  classic: { label: "Classic / simple", perGram: 35, minimum: 150 },
  detailed: { label: "Detailed custom", perGram: 55, minimum: 250 },
  pave: { label: "Pavé / stone intensive", perGram: 85, minimum: 400 },
};

async function goldSpot() {
  const fallback = Number(process.env.GOLD_PRICE_FALLBACK_USD_OZ || 2400);
  try {
    const response = await fetch("https://api.gold-api.com/price/XAU", { next: { revalidate: 300 } });
    if (!response.ok) throw new Error("market unavailable");
    const result = await response.json();
    const price = Number(result.price);
    if (!Number.isFinite(price) || price < 100) throw new Error("invalid market price");
    return { price, source: "Gold API", live: true, updatedAt: String(result.updatedAt || new Date().toISOString()) };
  } catch {
    return { price: fallback, source: "Protected fallback", live: false, updatedAt: new Date().toISOString() };
  }
}

function calculate(spot: number, karat: string, grams: number, complexity: string) {
  const purity = PURITY[karat];
  const craft = CRAFT[complexity];
  const pureGoldPerGram = spot / TROY_OUNCE_GRAMS;
  const metalCost = pureGoldPerGram * grams * purity;
  const metalAllowance = metalCost * 0.15;
  const craftsmanship = Math.max(craft.minimum, grams * craft.perGram);
  const estimate = Math.ceil((metalCost + metalAllowance + craftsmanship) / 5) * 5;
  return { purity, metalCost, metalAllowance, craftsmanship, estimate, craft };
}

export async function GET() {
  const market = await goldSpot();
  return Response.json({ market, purity: PURITY, craftsmanship: CRAFT, metalAllowancePercent: 15 });
}

export async function POST(request: Request) {
  const body = await request.json();
  const name = String(body.name || "").trim().slice(0, 120);
  const email = String(body.email || "").trim().toLowerCase().slice(0, 180);
  const phone = String(body.phone || "").trim().slice(0, 40);
  const description = String(body.description || "").trim().slice(0, 2000);
  const karat = String(body.karat || "14K");
  const complexity = String(body.complexity || "detailed");
  const grams = Number(body.grams);
  const stone = String(body.stone || "No stones").slice(0, 80);
  if (!name || !email.includes("@") || !description) return Response.json({ error: "Name, email, and a piece description are required." }, { status: 400 });
  if (!PURITY[karat] || !CRAFT[complexity] || !Number.isFinite(grams) || grams < 1 || grams > 1000) return Response.json({ error: "Choose valid gold, weight, and craftsmanship options." }, { status: 400 });

  await ensureAdminTables();
  const market = await goldSpot();
  const quote = calculate(market.price, karat, grams, complexity);
  const [customRequest] = await getSql()`
    INSERT INTO jd_custom_requests
      (customer_name, customer_email, customer_phone, description, karat, grams, stone, complexity, spot_price, purity, metal_cost, metal_allowance, craftsmanship, estimated_total, status)
    VALUES
      (${name}, ${email}, ${phone}, ${description}, ${karat}, ${grams}, ${stone}, ${complexity}, ${market.price}, ${quote.purity}, ${quote.metalCost}, ${quote.metalAllowance}, ${quote.craftsmanship}, ${quote.estimate}, 'pending')
    RETURNING id, estimated_total, status, created_at
  `;
  return Response.json({ request: customRequest, market, message: "Request received. No payment was taken. Jewelry Dept. will review and approve the final quote." });
}
