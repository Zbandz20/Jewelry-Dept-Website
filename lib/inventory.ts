import { getSql } from "@/lib/admin";

export type ReservedCartItem = { id: number; quantity: number };

const CHECKOUT_ADVISORY_LOCK_NAMESPACE = 1_904;

export async function reserveCheckoutInventory(
  reservationKey: string,
  cart: ReservedCartItem[],
  expiresAt: Date,
) {
  const sql = getSql();
  const normalizedCart = [...cart].sort((a, b) => a.id - b.id);
  const cartJson = JSON.stringify(normalizedCart);
  const results = await sql.transaction([
    sql`
      WITH expired AS (
        UPDATE jd_checkout_reservations
        SET status = 'expired', updated_at = NOW()
        WHERE expires_at <= NOW() AND status IN ('creating', 'open')
        RETURNING cart
      ), expired_items AS (
        SELECT (item->>'id')::integer AS id, SUM((item->>'quantity')::integer)::integer AS quantity
        FROM expired, jsonb_array_elements(expired.cart) AS item
        GROUP BY (item->>'id')::integer
      )
      UPDATE jd_products AS product
      SET inventory = product.inventory + expired_items.quantity, updated_at = NOW()
      FROM expired_items
      WHERE product.id = expired_items.id
      RETURNING product.id
    `,
    ...normalizedCart.map((item) => sql`SELECT pg_advisory_xact_lock(${CHECKOUT_ADVISORY_LOCK_NAMESPACE}, ${item.id})`),
    sql`
      WITH requested AS (
        SELECT (item->>'id')::integer AS id, (item->>'quantity')::integer AS quantity
        FROM jsonb_array_elements(${cartJson}::jsonb) AS item
      ), availability AS (
        SELECT
          COUNT(*)::integer AS requested_count,
          COUNT(p.id) FILTER (WHERE p.active = TRUE AND p.inventory >= requested.quantity)::integer AS available_count
        FROM requested
        LEFT JOIN jd_products p ON p.id = requested.id
      )
      INSERT INTO jd_checkout_reservations (reservation_key, cart, status, expires_at)
      SELECT ${reservationKey}, ${cartJson}::jsonb, 'creating', ${expiresAt.toISOString()}::timestamptz
      FROM availability
      WHERE requested_count > 0 AND requested_count = available_count
      ON CONFLICT (reservation_key) DO NOTHING
      RETURNING reservation_key
    `,
    sql`
      WITH requested AS (
        SELECT (item->>'id')::integer AS id, (item->>'quantity')::integer AS quantity
        FROM jsonb_array_elements(${cartJson}::jsonb) AS item
      )
      UPDATE jd_products AS product
      SET inventory = product.inventory - requested.quantity, updated_at = NOW()
      FROM requested
      WHERE product.id = requested.id
        AND EXISTS (SELECT 1 FROM jd_checkout_reservations WHERE reservation_key = ${reservationKey})
      RETURNING product.id
    `,
  ], { isolationLevel: "ReadCommitted" });

  return results[normalizedCart.length + 1].length === 1
    && results[normalizedCart.length + 2].length === normalizedCart.length;
}

export async function attachStripeSessionToReservation(
  reservationKey: string,
  sessionId: string,
  expiresAt: Date,
) {
  const rows = await getSql()`
    UPDATE jd_checkout_reservations
    SET stripe_session_id = ${sessionId}, status = 'open', expires_at = ${expiresAt.toISOString()}::timestamptz, updated_at = NOW()
    WHERE reservation_key = ${reservationKey} AND status = 'creating'
    RETURNING reservation_key
  `;
  return rows.length === 1;
}

export async function markCheckoutReservation(
  reservationKey: string,
  status: "paid" | "pending_payment",
) {
  if (!reservationKey) return false;
  const rows = await getSql()`
    WITH marked AS (
      UPDATE jd_checkout_reservations
      SET status = ${status}, updated_at = NOW()
      WHERE reservation_key = ${reservationKey} AND status IN ('creating', 'open', 'pending_payment')
      RETURNING reservation_key
    )
    SELECT
      EXISTS (SELECT 1 FROM marked)
      OR EXISTS (
        SELECT 1 FROM jd_checkout_reservations
        WHERE reservation_key = ${reservationKey} AND status = ${status}
      ) AS reserved
  `;
  return Boolean(rows[0]?.reserved);
}

export async function releaseCheckoutReservation(
  reservationKey: string,
  status: "failed" | "expired" | "payment_failed",
) {
  if (!reservationKey) return false;
  const rows = await getSql()`
    WITH released AS (
      UPDATE jd_checkout_reservations
      SET status = ${status}, updated_at = NOW()
      WHERE reservation_key = ${reservationKey} AND status IN ('creating', 'open', 'pending_payment')
      RETURNING cart
    ), released_items AS (
      SELECT (item->>'id')::integer AS id, (item->>'quantity')::integer AS quantity
      FROM released, jsonb_array_elements(released.cart) AS item
    )
    UPDATE jd_products AS product
    SET inventory = product.inventory + released_items.quantity, updated_at = NOW()
    FROM released_items
    WHERE product.id = released_items.id
    RETURNING product.id
  `;
  return rows.length > 0;
}
