import { randomUUID } from "crypto";
import { isAdmin } from "@/lib/admin";

export async function POST(request: Request) {
  if (!(await isAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const secret = process.env.STRIPE_TEST_SECRET_KEY || "";
  const webhookSecret = process.env.STRIPE_TEST_WEBHOOK_SECRET || "";
  if (!secret.startsWith("sk_test_") || !webhookSecret.startsWith("whsec_")) {
    return Response.json({ error: "Stripe test mode is not fully connected yet." }, { status: 503 });
  }

  const origin = new URL(request.url).origin;
  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("payment_method_types[0]", "card");
  form.set("payment_method_options[card][request_three_d_secure]", "any");
  form.set("line_items[0][price_data][currency]", "usd");
  form.set("line_items[0][price_data][product_data][name]", "Jewelry Dept. security test");
  form.set("line_items[0][price_data][product_data][description]", "Stripe sandbox only — no real charge or shipment");
  form.set("line_items[0][price_data][unit_amount]", "100");
  form.set("line_items[0][quantity]", "1");
  form.set("billing_address_collection", "required");
  form.set("shipping_address_collection[allowed_countries][0]", "US");
  form.set("shipping_address_collection[allowed_countries][1]", "MX");
  form.set("customer_creation", "always");
  form.set("success_url", `${origin}/admin/photos?security_test=complete`);
  form.set("cancel_url", `${origin}/admin/photos?security_test=cancelled`);
  form.set("metadata[security_test]", "true");
  form.set("metadata[cart]", "[]");
  form.set("payment_intent_data[description]", "Jewelry Dept. fraud-screening security test");
  form.set("payment_intent_data[metadata][security_test]", "true");

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": `jd-security-test-${randomUUID()}`,
    },
    body: form,
    cache: "no-store",
  });
  const session = await response.json();
  if (!response.ok || !session.url) {
    return Response.json({ error: session.error?.message || "Stripe test checkout could not start." }, { status: 502 });
  }
  return Response.json({ url: session.url });
}
