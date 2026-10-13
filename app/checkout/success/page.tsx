import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Payment Status — Jewelry Dept.",
  robots: { index: false, follow: false },
};

type CheckoutSuccessProps = {
  searchParams: Promise<{ session_id?: string | string[] }>;
};

async function hasVerifiedPayment(rawSessionId: string | string[] | undefined) {
  const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;
  const secret = process.env.STRIPE_SECRET_KEY || "";
  if (!secret || !sessionId || !/^cs_(?:test_|live_)?[A-Za-z0-9_]+$/.test(sessionId)) return false;

  try {
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
    if (!response.ok) return false;
    const session = await response.json();
    return session.status === "complete" && ["paid", "no_payment_required"].includes(session.payment_status);
  } catch {
    return false;
  }
}

export default async function CheckoutSuccess({ searchParams }: CheckoutSuccessProps) {
  const verified = await hasVerifiedPayment((await searchParams).session_id);
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#090909", color: "#ece8df", padding: 24, textAlign: "center" }}>
      <div>
        <p style={{ color: "#80c8f4", letterSpacing: ".2em", fontSize: 11 }}>JEWELRY DEPT.</p>
        <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 400, fontSize: "clamp(44px,8vw,86px)", margin: "20px 0" }}>
          {verified ? "Payment confirmed." : "Payment not verified."}
        </h1>
        <p style={{ color: "#aaa", lineHeight: 1.8, maxWidth: 560 }}>
          {verified
            ? "Stripe confirmed your payment. Your order is now being prepared for review and fulfillment."
            : "No completed payment was confirmed from this page. If you believe you were charged, contact Jewelry Dept. before trying again."}
        </p>
        <Link href="/" style={{ display: "inline-block", marginTop: 30, padding: "16px 24px", background: "#ece8df", color: "#090909", fontSize: 11, letterSpacing: ".12em" }}>
          RETURN TO STORE
        </Link>
      </div>
    </main>
  );
}
