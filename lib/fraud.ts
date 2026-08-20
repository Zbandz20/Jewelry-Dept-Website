type StripeAddress = { country?: string | null };
type StripeCharge = {
  id?: string;
  outcome?: {
    risk_level?: string | null;
    risk_score?: number | null;
    seller_message?: string | null;
  } | null;
  payment_method_details?: {
    card?: {
      checks?: {
        address_line1_check?: string | null;
        address_postal_code_check?: string | null;
        cvc_check?: string | null;
      } | null;
      three_d_secure?: { result?: string | null } | null;
    } | null;
  } | null;
  billing_details?: { address?: StripeAddress | null } | null;
};
type StripePaymentIntent = {
  id?: string;
  latest_charge?: StripeCharge | string | null;
  review?: string | null;
};
type FraudSession = {
  payment_intent?: string | { id?: string } | null;
  amount_total?: number | null;
};
type ShippingDetails = { address?: StripeAddress | null };

export type FraudAssessment = {
  riskLevel: "normal" | "elevated" | "highest" | "not_assessed";
  riskScore: number | null;
  signals: string[];
  reviewStatus: "clear" | "pending";
  fulfillmentHold: boolean;
  paymentIntentId: string;
  chargeId: string;
};

async function stripeGet<T>(path: string): Promise<T | null> {
  const secret = process.env.STRIPE_SECRET_KEY || "";
  if (!secret) return null;
  const response = await fetch(`https://api.stripe.com${path}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return response.json() as Promise<T>;
}

export async function assessOrderFraud(session: FraudSession, shipping: ShippingDetails): Promise<FraudAssessment> {
  const paymentIntentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : String(session.payment_intent?.id || "");
  const amountCents = Math.max(0, Number(session.amount_total || 0));
  const signals: string[] = [];

  if (!paymentIntentId) {
    return {
      riskLevel: amountCents >= 50_000 ? "elevated" : "not_assessed",
      riskScore: null,
      signals: ["Stripe risk information was unavailable."],
      reviewStatus: amountCents >= 50_000 ? "pending" : "clear",
      fulfillmentHold: amountCents >= 50_000,
      paymentIntentId: "",
      chargeId: "",
    };
  }

  const paymentIntent = await stripeGet<StripePaymentIntent>(
    `/v1/payment_intents/${encodeURIComponent(paymentIntentId)}?expand%5B%5D=latest_charge`
  );
  let charge = paymentIntent && typeof paymentIntent.latest_charge === "object"
    ? paymentIntent.latest_charge
    : null;
  if (!charge && typeof paymentIntent?.latest_charge === "string") {
    charge = await stripeGet<StripeCharge>(`/v1/charges/${encodeURIComponent(paymentIntent.latest_charge)}`);
  }

  if (!paymentIntent || !charge) {
    const hold = amountCents >= 50_000;
    return {
      riskLevel: hold ? "elevated" : "not_assessed",
      riskScore: null,
      signals: ["Stripe risk assessment could not be completed."],
      reviewStatus: hold ? "pending" : "clear",
      fulfillmentHold: hold,
      paymentIntentId,
      chargeId: typeof paymentIntent?.latest_charge === "string" ? paymentIntent.latest_charge : "",
    };
  }

  const stripeLevel = String(charge.outcome?.risk_level || "not_assessed").toLowerCase();
  const stripeScoreValue = Number(charge.outcome?.risk_score);
  const stripeScore = Number.isFinite(stripeScoreValue) ? Math.max(0, Math.min(100, stripeScoreValue)) : null;
  let score = stripeScore ?? 0;
  if (stripeScore !== null) signals.push(`Stripe Radar score: ${stripeScore}/100.`);
  if (stripeLevel === "elevated") signals.push("Stripe Radar marked the payment as elevated risk.");
  if (stripeLevel === "highest") signals.push("Stripe Radar marked the payment as highest risk.");

  const checks = charge.payment_method_details?.card?.checks || {};
  const cvcFailed = checks.cvc_check === "fail";
  const postalFailed = checks.address_postal_code_check === "fail";
  const line1Failed = checks.address_line1_check === "fail";
  if (cvcFailed) { score += 25; signals.push("Card security code verification failed."); }
  if (postalFailed) { score += 15; signals.push("Billing postal-code verification failed."); }
  if (line1Failed) { score += 10; signals.push("Billing street-address verification failed."); }

  const billingCountry = String(charge.billing_details?.address?.country || "").toUpperCase();
  const shippingCountry = String(shipping.address?.country || "").toUpperCase();
  const countryMismatch = Boolean(billingCountry && shippingCountry && billingCountry !== shippingCountry);
  if (countryMismatch) { score += 10; signals.push("Billing and shipping countries do not match."); }

  if (amountCents >= 250_000) { score += 10; signals.push("Order total is $2,500 or more."); }
  else if (amountCents >= 100_000) { score += 5; signals.push("Order total is $1,000 or more."); }

  const radarReview = Boolean(paymentIntent.review);
  if (radarReview) { score = Math.max(score, 65); signals.push("Stripe Radar opened a manual review."); }
  score = Math.max(0, Math.min(100, score));

  let riskLevel: FraudAssessment["riskLevel"] = "normal";
  if (stripeLevel === "highest" || score >= 75 || cvcFailed) riskLevel = "highest";
  else if (stripeLevel === "elevated" || score >= 65 || postalFailed || line1Failed || countryMismatch || radarReview) riskLevel = "elevated";
  else if (!["normal", "elevated", "highest"].includes(stripeLevel)) riskLevel = "not_assessed";

  const notAssessedHighValue = riskLevel === "not_assessed" && amountCents >= 50_000;
  if (notAssessedHighValue) signals.push("High-value payment was not assessed by Stripe Radar.");
  const fulfillmentHold = riskLevel === "elevated" || riskLevel === "highest" || notAssessedHighValue;

  if (!signals.length) signals.push("No elevated fraud signals were returned.");

  return {
    riskLevel,
    riskScore: stripeScore === null && riskLevel === "not_assessed" ? null : score,
    signals,
    reviewStatus: fulfillmentHold ? "pending" : "clear",
    fulfillmentHold,
    paymentIntentId,
    chargeId: String(charge.id || ""),
  };
}
