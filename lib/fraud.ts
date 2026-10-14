export type StripeAddress = {
  city?: string | null;
  country?: string | null;
  line1?: string | null;
  line2?: string | null;
  postal_code?: string | null;
  state?: string | null;
};

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
  billing_details?: { name?: string | null; address?: StripeAddress | null } | null;
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
type ShippingDetails = { name?: string | null; address?: StripeAddress | null };

type AddressField = "street" | "unit" | "city" | "state" | "postal code" | "country";

export type AddressComparison = {
  status: "match" | "mismatch" | "incomplete";
  mismatchedFields: AddressField[];
  missingFields: AddressField[];
};

export type FraudAssessment = {
  riskLevel: "normal" | "elevated" | "highest" | "not_assessed";
  riskScore: number | null;
  signals: string[];
  reviewStatus: "clear" | "pending";
  fulfillmentHold: boolean;
  paymentIntentId: string;
  chargeId: string;
  addressMatchStatus: AddressComparison["status"];
  billingDetails: { name: string; address: StripeAddress };
};

const STREET_TOKENS: Record<string, string> = {
  alley: "aly", avenue: "ave", boulevard: "blvd", circle: "cir", court: "ct",
  drive: "dr", highway: "hwy", lane: "ln", parkway: "pkwy", place: "pl",
  road: "rd", square: "sq", street: "st", terrace: "ter", trail: "trl",
  north: "n", south: "s", east: "e", west: "w", northeast: "ne",
  northwest: "nw", southeast: "se", southwest: "sw",
};

const REGION_CODES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS",
  kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA",
  michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT",
  nebraska: "NE", nevada: "NV", newhampshire: "NH", newjersey: "NJ", newmexico: "NM",
  newyork: "NY", northcarolina: "NC", northdakota: "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", rhodeisland: "RI", southcarolina: "SC",
  southdakota: "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", westvirginia: "WV", wisconsin: "WI", wyoming: "WY",
  aguascalientes: "AGS", bajacalifornia: "BC", bajacaliforniasur: "BCS", campeche: "CAM",
  chiapas: "CHIS", chihuahua: "CHIH", coahuila: "COAH", colima: "COL", durango: "DGO",
  guanajuato: "GTO", guerrero: "GRO", hidalgo: "HGO", jalisco: "JAL", mexico: "MEX",
  michoacan: "MICH", morelos: "MOR", nayarit: "NAY", nuevoleon: "NL", oaxaca: "OAX",
  puebla: "PUE", queretaro: "QRO", quintanaroo: "QROO", sanluispotosi: "SLP",
  sinaloa: "SIN", sonora: "SON", tabasco: "TAB", tamaulipas: "TAMPS", tlaxcala: "TLAX",
  veracruz: "VER", yucatan: "YUC", zacatecas: "ZAC", ciudadmexico: "CDMX",
};

function plain(value: unknown) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizedStreet(value: unknown) {
  return plain(value).split(" ").filter(Boolean).map(token => STREET_TOKENS[token] || token).join(" ");
}

function normalizedUnit(value: unknown) {
  return plain(value).split(" ").filter(token => token && !["apartment", "apt", "suite", "ste", "unit"].includes(token)).join(" ");
}

function normalizedRegion(value: unknown) {
  const compact = plain(value).replace(/\s/g, "");
  return REGION_CODES[compact] || compact.toUpperCase();
}

function normalizedCountry(value: unknown) {
  const compact = plain(value).replace(/\s/g, "");
  if (["us", "usa", "unitedstates", "unitedstatesofamerica"].includes(compact)) return "US";
  if (["mx", "mex", "mexico"].includes(compact)) return "MX";
  return compact.toUpperCase();
}

function normalizedPostal(value: unknown, country: string) {
  const compact = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return country === "US" ? compact.slice(0, 5) : compact;
}

export function compareBillingAndShippingAddresses(
  billing: StripeAddress | null | undefined,
  shipping: StripeAddress | null | undefined,
): AddressComparison {
  const billingCountry = normalizedCountry(billing?.country);
  const shippingCountry = normalizedCountry(shipping?.country);
  const requiredFields: Array<{ field: AddressField; billing: string; shipping: string }> = [
    { field: "street", billing: normalizedStreet(billing?.line1), shipping: normalizedStreet(shipping?.line1) },
    { field: "city", billing: plain(billing?.city), shipping: plain(shipping?.city) },
    { field: "state", billing: normalizedRegion(billing?.state), shipping: normalizedRegion(shipping?.state) },
    { field: "postal code", billing: normalizedPostal(billing?.postal_code, billingCountry), shipping: normalizedPostal(shipping?.postal_code, shippingCountry) },
    { field: "country", billing: billingCountry, shipping: shippingCountry },
  ];
  const missingFields = requiredFields.filter(({ billing: left, shipping: right }) => !left || !right).map(({ field }) => field);
  const mismatchedFields = requiredFields
    .filter(({ billing: left, shipping: right }) => left && right && left !== right)
    .map(({ field }) => field);
  const billingUnit = normalizedUnit(billing?.line2);
  const shippingUnit = normalizedUnit(shipping?.line2);
  if ((billingUnit || shippingUnit) && billingUnit !== shippingUnit) mismatchedFields.push("unit");
  return {
    status: mismatchedFields.length ? "mismatch" : missingFields.length ? "incomplete" : "match",
    mismatchedFields,
    missingFields,
  };
}

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
  const unavailableBilling = { name: "", address: {} };

  if (!paymentIntentId) {
    return {
      riskLevel: "elevated",
      riskScore: null,
      signals: ["Stripe risk information and billing-address verification were unavailable."],
      reviewStatus: "pending",
      fulfillmentHold: true,
      paymentIntentId: "",
      chargeId: "",
      addressMatchStatus: "incomplete",
      billingDetails: unavailableBilling,
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
    return {
      riskLevel: "elevated",
      riskScore: null,
      signals: ["Stripe risk and address assessment could not be completed."],
      reviewStatus: "pending",
      fulfillmentHold: true,
      paymentIntentId,
      chargeId: typeof paymentIntent?.latest_charge === "string" ? paymentIntent.latest_charge : "",
      addressMatchStatus: "incomplete",
      billingDetails: unavailableBilling,
    };
  }

  const billingAddress = charge.billing_details?.address || {};
  const billingDetails = { name: String(charge.billing_details?.name || ""), address: billingAddress };
  const addressComparison = compareBillingAndShippingAddresses(billingAddress, shipping.address);
  if (addressComparison.status === "match") {
    signals.push("Billing and shipping addresses match.");
  } else {
    for (const field of addressComparison.mismatchedFields) {
      signals.push(`Billing and shipping ${field} do not match.`);
    }
    if (addressComparison.missingFields.length) {
      signals.push(`Address comparison was incomplete (missing ${addressComparison.missingFields.join(", ")}).`);
    }
  }

  const stripeLevel = String(charge.outcome?.risk_level || "not_assessed").toLowerCase();
  const stripeScoreValue = charge.outcome?.risk_score;
  const stripeScore = typeof stripeScoreValue === "number" && Number.isFinite(stripeScoreValue)
    ? Math.max(0, Math.min(100, stripeScoreValue))
    : null;
  let score = stripeScore ?? 0;
  if (stripeScore !== null) signals.push(`Stripe Radar score: ${stripeScore}/100.`);
  if (stripeLevel === "elevated") signals.push("Stripe Radar marked the payment as elevated risk.");
  if (stripeLevel === "highest") signals.push("Stripe Radar marked the payment as highest risk.");

  const checks = charge.payment_method_details?.card?.checks || {};
  const cvcFailed = checks.cvc_check === "fail";
  const postalFailed = checks.address_postal_code_check === "fail";
  const line1Failed = checks.address_line1_check === "fail";
  const issuerChecksIncomplete = checks.cvc_check !== "pass"
    || checks.address_postal_code_check !== "pass"
    || checks.address_line1_check !== "pass";
  if (cvcFailed) { score += 25; signals.push("Card security code verification failed."); }
  if (postalFailed) { score += 20; signals.push("Issuer billing postal-code verification failed."); }
  if (line1Failed) { score += 15; signals.push("Issuer billing street-address verification failed."); }
  if (!cvcFailed && checks.cvc_check !== "pass") signals.push("Card security code verification was unavailable or incomplete.");
  if (!postalFailed && checks.address_postal_code_check !== "pass") signals.push("Issuer billing postal-code verification was unavailable or incomplete.");
  if (!line1Failed && checks.address_line1_check !== "pass") signals.push("Issuer billing street-address verification was unavailable or incomplete.");
  if (issuerChecksIncomplete && !cvcFailed && !postalFailed && !line1Failed) score += 10;

  const mismatchWeights: Record<AddressField, number> = {
    street: 15, unit: 10, city: 5, state: 10, "postal code": 20, country: 25,
  };
  for (const field of addressComparison.mismatchedFields) score += mismatchWeights[field];
  if (addressComparison.status === "incomplete") score += 20;

  const threeDsResult = String(charge.payment_method_details?.card?.three_d_secure?.result || "").toLowerCase();
  const threeDsFailed = threeDsResult === "failed";
  if (threeDsResult === "authenticated") signals.push("3-D Secure identity verification succeeded.");
  else if (threeDsFailed) { score += 25; signals.push("3-D Secure identity verification failed."); }
  else if (threeDsResult) signals.push(`3-D Secure result: ${threeDsResult.replaceAll("_", " ")}.`);
  else signals.push("3-D Secure identity verification was unavailable or incomplete.");

  if (amountCents >= 250_000) { score += 10; signals.push("Order total is $2,500 or more."); }
  else if (amountCents >= 100_000) { score += 5; signals.push("Order total is $1,000 or more."); }

  const radarReview = Boolean(paymentIntent.review);
  if (radarReview) { score = Math.max(score, 65); signals.push("Stripe Radar opened a manual review."); }
  score = Math.max(0, Math.min(100, score));

  const addressNeedsReview = addressComparison.status !== "match";
  const threeDsNeedsReview = threeDsResult !== "authenticated";
  let riskLevel: FraudAssessment["riskLevel"] = "normal";
  if (stripeLevel === "highest" || score >= 75 || cvcFailed || threeDsFailed) riskLevel = "highest";
  else if (stripeLevel === "elevated" || score >= 65 || postalFailed || line1Failed || issuerChecksIncomplete || addressNeedsReview || radarReview || threeDsNeedsReview) riskLevel = "elevated";
  else if (!["normal", "elevated", "highest"].includes(stripeLevel)) riskLevel = "not_assessed";

  const notAssessed = riskLevel === "not_assessed";
  if (notAssessed) signals.push("Payment was not assessed by Stripe Radar.");
  const fulfillmentHold = riskLevel === "elevated" || riskLevel === "highest" || notAssessed;

  if (!signals.length) signals.push("No elevated fraud signals were returned.");

  return {
    riskLevel,
    riskScore: stripeScore === null && riskLevel === "not_assessed" ? null : score,
    signals,
    reviewStatus: fulfillmentHold ? "pending" : "clear",
    fulfillmentHold,
    paymentIntentId,
    chargeId: String(charge.id || ""),
    addressMatchStatus: addressComparison.status,
    billingDetails,
  };
}
