"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function storefrontSession() {
  const key = "jd-session";
  let sessionId = sessionStorage.getItem(key);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(key, sessionId);
  }
  return sessionId;
}

function track(eventName: "product_view" | "checkout_start", productId: number, amount: number) {
  const sessionId = storefrontSession();
  fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, eventName, productId, amount, path: window.location.pathname }),
  }).catch(() => {});
}

export default function ProductPurchase({
  id,
  price,
  inventory,
  checkoutEnabled,
}: {
  id: number;
  price: number;
  inventory: number;
  checkoutEnabled: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { track("product_view", id, price); }, [id, price]);

  async function buyNow() {
    if (!checkoutEnabled) return;
    setBusy(true);
    setMessage("");
    track("checkout_start", id, price);
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ id, quantity: 1 }] }),
    });
    const result = await response.json();
    if (!response.ok || !result.url) {
      setBusy(false);
      setMessage(result.error || "Secure checkout could not open.");
      return;
    }
    window.location.assign(result.url);
  }

  return (
    <div className="productPurchase">
      <button className="primary productBuyNow" disabled={inventory < 1 || !checkoutEnabled || busy} onClick={buyNow}>
        {inventory < 1
          ? "SOLD OUT"
          : !checkoutEnabled
            ? "CHECKOUT COMING SOON"
            : busy
              ? "OPENING SECURE CHECKOUT…"
              : "BUY THIS PIECE →"}
      </button>
      <Link className="productContinue" href="/#pieces">CONTINUE SHOPPING</Link>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
