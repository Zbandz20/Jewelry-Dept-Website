import { ensureAdminTables, getSql, isAdmin } from "@/lib/admin";
import { escapeHtml, sendTransactionalEmail } from "@/lib/email";

const shippoHeaders = () => ({
  Authorization: `ShippoToken ${process.env.SHIPPO_API_TOKEN || ""}`,
  "Content-Type": "application/json",
  "SHIPPO-API-VERSION": "2018-02-08",
});

export async function POST(request: Request) {
  if (!(await isAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.SHIPPO_API_TOKEN) return Response.json({ error: "Connect Shippo before creating labels." }, { status: 400 });
  await ensureAdminTables();
  const body = await request.json();
  const sql = getSql();
  const [order] = await sql`SELECT * FROM jd_orders WHERE id = ${Number(body.orderId)} LIMIT 1`;
  if (!order) return Response.json({ error: "Order not found." }, { status: 404 });
  if (order.fulfillment_hold) {
    return Response.json({ error: "This order is on a fraud-review hold. Approve it in Orders before creating a shipping label." }, { status: 409 });
  }

  if (body.action === "quote") {
    const shipping = order.shipping_address || {};
    const destination = shipping.address || shipping;
    if (!destination?.line1 || !destination?.postal_code) return Response.json({ error: "This order does not have a complete shipping address." }, { status: 400 });
    const requiredOrigin = ["SHIP_FROM_NAME", "SHIP_FROM_STREET1", "SHIP_FROM_CITY", "SHIP_FROM_STATE", "SHIP_FROM_ZIP"];
    if (requiredOrigin.some(key => !process.env[key])) return Response.json({ error: "Your return address must be added before labels can be created." }, { status: 400 });
    const shipmentResponse = await fetch("https://api.goshippo.com/shipments", {
      method: "POST", headers: shippoHeaders(), body: JSON.stringify({
        address_from: { name: process.env.SHIP_FROM_NAME, company: process.env.SHIP_FROM_COMPANY || "Jewelry Dept.", street1: process.env.SHIP_FROM_STREET1, street2: process.env.SHIP_FROM_STREET2 || "", city: process.env.SHIP_FROM_CITY, state: process.env.SHIP_FROM_STATE, zip: process.env.SHIP_FROM_ZIP, country: process.env.SHIP_FROM_COUNTRY || "US", phone: process.env.SHIP_FROM_PHONE || "", email: process.env.SHIP_FROM_EMAIL || "" },
        address_to: { name: shipping.name || order.customer_name, street1: destination.line1, street2: destination.line2 || "", city: destination.city, state: destination.state, zip: destination.postal_code, country: destination.country || "US", email: order.customer_email },
        parcels: [{ length: process.env.SHIP_PARCEL_LENGTH || "8", width: process.env.SHIP_PARCEL_WIDTH || "6", height: process.env.SHIP_PARCEL_HEIGHT || "3", distance_unit: "in", weight: process.env.SHIP_PARCEL_WEIGHT_OZ || "16", mass_unit: "oz" }],
        async: false,
      }),
    });
    const shipment = await shipmentResponse.json();
    const rates = Array.isArray(shipment.rates) ? shipment.rates.filter((rate: { amount?: string }) => Number(rate.amount) > 0) : [];
    rates.sort((a: { amount: string }, b: { amount: string }) => Number(a.amount) - Number(b.amount));
    const rate = rates[0];
    if (!shipmentResponse.ok || !rate) return Response.json({ error: shipment.messages?.[0]?.text || "No shipping rates were returned." }, { status: 502 });
    return Response.json({ rateId: rate.object_id, amount: rate.amount, provider: rate.provider, service: rate.servicelevel?.name || "shipping" });
  }

  if (body.action === "purchase") {
    if (!body.rateId) return Response.json({ error: "Choose a shipping rate first." }, { status: 400 });
    const transactionResponse = await fetch("https://api.goshippo.com/transactions", { method: "POST", headers: shippoHeaders(), body: JSON.stringify({ rate: String(body.rateId), async: false, label_file_type: "PDF_4x6" }) });
    const transaction = await transactionResponse.json();
    if (!transactionResponse.ok || transaction.status !== "SUCCESS" || !transaction.label_url) return Response.json({ error: transaction.messages?.[0]?.text || "The carrier did not create a label." }, { status: 502 });
    await sql`UPDATE jd_orders SET label_url = ${transaction.label_url}, tracking_number = ${transaction.tracking_number || ""}, tracking_url = ${transaction.tracking_url_provider || ""}, status = 'ready_to_ship' WHERE id = ${Number(body.orderId)}`;
    if (order.customer_email) {
      const trackingNumber = String(transaction.tracking_number || "");
      const trackingUrl = String(transaction.tracking_url_provider || "");
      const trackingAction = trackingUrl
        ? `<p><a href="${escapeHtml(trackingUrl)}" style="display:inline-block;padding:13px 18px;background:#287fad;color:#fff;text-decoration:none">TRACK YOUR ORDER</a></p>`
        : "";
      await sendTransactionalEmail({
        to: String(order.customer_email),
        subject: `Jewelry Dept. order #${Number(body.orderId)} is ready to ship`,
        html: `<div style="font-family:Arial,sans-serif;color:#111"><p style="letter-spacing:.12em">JEWELRY DEPT.</p><h1>Your tracking is ready.</h1><p>Your order #${Number(body.orderId)} has been prepared for shipment.</p><p>Tracking number: <strong>${escapeHtml(trackingNumber || "Pending carrier scan")}</strong></p>${trackingAction}<p>Carrier scans can take several hours to appear.</p></div>`,
      });
    }
    return Response.json({ labelUrl: transaction.label_url, trackingNumber: transaction.tracking_number || "" });
  }
  return Response.json({ error: "Unknown shipping action." }, { status: 400 });
}
