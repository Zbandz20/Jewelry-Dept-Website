import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { neon } from "@neondatabase/serverless";

export function getSql() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return neon(process.env.DATABASE_URL);
}

async function ensureAdminAuthTable() {
  const sql = getSql();
  await sql`CREATE TABLE IF NOT EXISTS jd_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
}

async function savedPasswordHash() {
  await ensureAdminAuthTable();
  const rows = await getSql()`SELECT value FROM jd_settings WHERE key = 'admin_password_hash' LIMIT 1`;
  return rows[0]?.value ? String(rows[0].value) : "";
}

export async function verifyAdminPassword(password: string) {
  const saved = await savedPasswordHash();
  if (!saved) {
    const original = process.env.ADMIN_PASSWORD || "";
    if (!original || password.length !== original.length) return false;
    return timingSafeEqual(Buffer.from(password), Buffer.from(original));
  }
  const [salt, expected] = saved.split(":");
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64).toString("hex");
  return actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export async function setAdminPassword(password: string) {
  await ensureAdminAuthTable();
  const salt = randomBytes(16).toString("hex");
  const value = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
  await getSql()`INSERT INTO jd_settings (key, value, updated_at) VALUES ('admin_password_hash', ${value}, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
}

function hashRecoveryAnswer(answer: string, salt: string) {
  return scryptSync(answer.trim().toLocaleLowerCase(), salt, 64).toString("hex");
}

export async function setRecoveryQuestion(question: string, answer: string) {
  await ensureAdminAuthTable();
  const salt = randomBytes(16).toString("hex");
  const answerHash = `${salt}:${hashRecoveryAnswer(answer, salt)}`;
  const sql = getSql();
  await sql`
    INSERT INTO jd_settings (key, value, updated_at) VALUES
      ('admin_security_question', ${question.trim()}, NOW()),
      ('admin_security_answer_hash', ${answerHash}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `;
}

export async function getRecoveryQuestion() {
  await ensureAdminAuthTable();
  const rows = await getSql()`SELECT value FROM jd_settings WHERE key = 'admin_security_question' LIMIT 1`;
  return rows[0]?.value ? String(rows[0].value) : "";
}

export async function getCheckoutEnabled() {
  await ensureAdminAuthTable();
  const rows = await getSql()`SELECT value FROM jd_settings WHERE key = 'checkout_enabled' LIMIT 1`;
  return rows[0]?.value === "true";
}

export async function setCheckoutEnabled(enabled: boolean) {
  await ensureAdminAuthTable();
  await getSql()`INSERT INTO jd_settings (key, value, updated_at) VALUES ('checkout_enabled', ${enabled ? "true" : "false"}, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
}

export async function verifyRecoveryAnswer(answer: string) {
  await ensureAdminAuthTable();
  const rows = await getSql()`SELECT value FROM jd_settings WHERE key = 'admin_security_answer_hash' LIMIT 1`;
  const saved = rows[0]?.value ? String(rows[0].value) : "";
  const [salt, expected] = saved.split(":");
  if (!salt || !expected) return false;
  const actual = hashRecoveryAnswer(answer, salt);
  return actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export async function adminToken() {
  const credential = (await savedPasswordHash()) || process.env.ADMIN_PASSWORD || "";
  return createHash("sha256").update(`jewelry-dept:${credential}`).digest("hex");
}

export async function isAdmin() {
  if (!process.env.ADMIN_PASSWORD) return false;
  const cookie = (await cookies()).get("jd_admin")?.value || "";
  const expected = await adminToken();
  if (cookie.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(cookie), Buffer.from(expected));
}

export async function ensureAdminTables() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS jd_products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      sku TEXT NOT NULL DEFAULT '',
      price NUMERIC(12,2) NOT NULL DEFAULT 0,
      inventory INTEGER NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      image_url TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE jd_products ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''`;
  await sql`
    CREATE TABLE IF NOT EXISTS jd_orders (
      id SERIAL PRIMARY KEY,
      customer_name TEXT NOT NULL DEFAULT 'Online customer',
      customer_email TEXT NOT NULL DEFAULT '',
      total NUMERIC(12,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE jd_orders ADD COLUMN IF NOT EXISTS stripe_session_id TEXT`;
  await sql`ALTER TABLE jd_orders ADD COLUMN IF NOT EXISTS shipping_address JSONB`;
  await sql`ALTER TABLE jd_orders ADD COLUMN IF NOT EXISTS label_url TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE jd_orders ADD COLUMN IF NOT EXISTS tracking_number TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE jd_orders ADD COLUMN IF NOT EXISTS tracking_url TEXT NOT NULL DEFAULT ''`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS jd_orders_stripe_session_idx ON jd_orders(stripe_session_id) WHERE stripe_session_id IS NOT NULL`;
  await sql`
    CREATE TABLE IF NOT EXISTS jd_assets (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      data_url TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS jd_visits (
      id BIGSERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS jd_visits_created_idx ON jd_visits(created_at)`;

  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM jd_products`;
  if (Number(count) === 0) {
    await sql`
      INSERT INTO jd_products (name, sku, price, inventory, active) VALUES
      ('La Corona', 'JD-LC-12', 1450, 4, TRUE),
      ('La Cadena', 'JD-CD-10', 1290, 6, TRUE),
      ('Solitario', 'JD-SOL-2', 890, 8, TRUE),
      ('La Cruz', 'JD-CRUZ-14', 980, 3, TRUE)
    `;
  }
  await sql`
    INSERT INTO jd_assets (id, label, data_url) VALUES
    ('hero', 'Homepage hero', ''),
    ('featured', 'Featured Cuban chain', '')
    ON CONFLICT (id) DO NOTHING
  `;
}
