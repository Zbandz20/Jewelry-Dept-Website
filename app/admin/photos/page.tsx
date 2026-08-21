"use client";

import { useEffect, useState } from "react";
import "./admin.css";
import "./security.css";
import "./catalog.css";

type DashboardData = {
  summary: { total_orders: number; gross: number; live_visitors: number; visitors_today: number; average_order: number; fraud_reviews: number; product_views_today: number; add_to_cart_today: number; checkout_starts_today: number };
  products: Array<{ id: number; name: string; sku: string; price: number; inventory: number; active: boolean; image_url: string; description: string }>;
  orders: Array<{
    id: number;
    customer_name: string;
    customer_email: string;
    total: number;
    status: string;
    created_at: string;
    shipping_address?: { address?: Record<string,string> };
    label_url?: string;
    tracking_number?: string;
    tracking_url?: string;
    fraud_risk_level?: "normal" | "elevated" | "highest" | "not_assessed";
    fraud_risk_score?: number | null;
    fraud_signals?: string[];
    fraud_review_status?: "clear" | "pending" | "approved" | "rejected" | "disputed";
    fulfillment_hold?: boolean;
  }>;
  assets: Array<{ id: string; label: string; data_url: string; updated_at: string }>;
  customRequests: Array<{ id: number; customer_name: string; customer_email: string; customer_phone: string; description: string; karat: string; grams: number; stone: string; complexity: string; spot_price: number; metal_cost: number; metal_allowance: number; craftsmanship: number; estimated_total: number; approved_total?: number; status: string; created_at: string }>;
  checkoutEnabled: boolean;
  stripeReady: boolean;\n  emailReady: boolean;\n  shippoReady: boolean;\n};

export default function AdminPhotos() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");
  const [saving, setSaving] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [securityQuestion, setSecurityQuestion] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [securityMessage, setSecurityMessage] = useState("");
  const [approvalPassword, setApprovalPassword] = useState("");
  const [approvalPhrase, setApprovalPhrase] = useState("");
  const [fraudPassword, setFraudPassword] = useState("");
  const [approvedTotal, setApprovedTotal] = useState<Record<number, number>>({});

  async function load() {
    const response = await fetch("/api/admin/dashboard", { cache: "no-store" });
    if (response.ok) setData(await response.json());
  }
  useEffect(() => { load(); const timer = setInterval(load, 30000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (tab !== "security" || !data) return;
    fetch("/api/admin/security", { cache: "no-store" }).then(response => response.ok ? response.json() : null).then(result => {
      if (result?.question) setSecurityQuestion(result.question);
    }).catch(() => {});
  }, [tab, data]);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    if (!response.ok) return setError("That password didn’t work.");
    setError(""); await load();
  }

  async function saveProduct(product: DashboardData["products"][number]) {
    setSaving(`product-${product.id}`);
    await fetch("/api/admin/dashboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "product", ...product }) });
    setSaving(""); await load();
  }

  async function addProduct() {
    setSaving("new-product");
    const response = await fetch("/api/admin/dashboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "product-create", name: `New product ${Date.now().toString().slice(-4)}` }) });
    setSaving("");
    if (!response.ok) return setError("A product could not be added.");
    await load();
  }

  async function importShopify() {
    setSaving("shopify-import"); setError("");
    const response = await fetch("/api/admin/dashboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "shopify-import", store: "https://jewelrydeptaz.myshopify.com" }) });
    const result = await response.json(); setSaving("");
    if (!response.ok) return setError(result.error || "Shopify products could not be imported.");
    await load(); setError(`${result.imported} Shopify products imported. Review quantities before activating checkout.`);
  }

  async function upload(id: string, file?: File) {
    if (!file) return;
    if (file.size > 2_800_000) return setError("Please choose an image smaller than 2.8 MB.");
    const reader = new FileReader();
    reader.onload = async () => {
      setSaving(`asset-${id}`);
      await fetch("/api/admin/dashboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "asset", id, dataUrl: reader.result }) });
      setSaving(""); await load();
    };
    reader.readAsDataURL(file);
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    setPasswordMessage("");
    if (newPassword !== confirmPassword) return setPasswordMessage("New passwords do not match.");
    setSaving("password");
    const response = await fetch("/api/admin/password", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });
    const result = await response.json();
    setSaving("");
    if (!response.ok) return setPasswordMessage(result.error || "Password could not be changed.");
    setNewPassword(""); setConfirmPassword("");
    setPasswordMessage("Password updated successfully.");
  }

  async function startRecovery() {
    setError("");
    setSaving("recovery");
    const response = await fetch("/api/admin/recovery", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "request" }),
    });
    const result = await response.json();
    setSaving("");
    if (!response.ok) return setError(result.error || "Password recovery is not available.");
    setSecurityMessage(result.message || "A secure reset link has been sent.");
    setRecoveryMode(true);
  }

  async function recoverPassword(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) return setError("New passwords do not match.");
    const response = await fetch("/api/admin/recovery", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer: securityAnswer, newPassword }),
    });
    const result = await response.json();
    if (!response.ok) return setError(result.error || "Password could not be reset.");
    setSecurityAnswer(""); setNewPassword(""); setConfirmPassword("");
    await load();
  }

  async function saveRecoveryQuestion(event: React.FormEvent) {
    event.preventDefault();
    setSecurityMessage("");
    const response = await fetch("/api/admin/security", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: securityQuestion, answer: securityAnswer }),
    });
    const result = await response.json();
    if (!response.ok) return setSecurityMessage(result.error || "Security question could not be saved.");
    setSecurityAnswer("");
    setSecurityMessage("Security question saved successfully.");
  }

  async function toggleCheckout() {
    if (!data) return;
    setSaving("checkout");
    const response = await fetch("/api/admin/dashboard", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "checkout-toggle", enabled: !data.checkoutEnabled }),
    });
    const result = await response.json();
    setSaving("");
    if (!response.ok) return setError(result.error || "Checkout could not be updated.");
    setError(""); await load();
  }

  async function createLabel(orderId: number) {
    setSaving(`label-${orderId}`); setError("");
    const quoteResponse = await fetch("/api/admin/shipping", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "quote", orderId }) });
    const quote = await quoteResponse.json();
    if (!quoteResponse.ok) { setSaving(""); return setError(quote.error || "Shipping rates are not available."); }
    const approved = window.confirm(`Buy a ${quote.provider} ${quote.service} label for $${Number(quote.amount).toFixed(2)}?`);
    if (!approved) { setSaving(""); return; }
    const buyResponse = await fetch("/api/admin/shipping", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "purchase", orderId, rateId: quote.rateId }) });
    const result = await buyResponse.json(); setSaving("");
    if (!buyResponse.ok) return setError(result.error || "The label could not be purchased.");
    await load(); window.open(result.labelUrl, "_blank", "noopener,noreferrer");
  }

  async function reviewFraudOrder(id: number, decision: "approve" | "reject") {
    if (!fraudPassword) return setError("Enter the dashboard password before reviewing a held order.");
    const message = decision === "approve"
      ? "Release this order for fulfillment? Confirm the customer and payment details in Stripe first."
      : "Keep this order blocked as suspected fraud? This does not issue a refund in Stripe.";
    if (!window.confirm(message)) return;
    setSaving(`fraud-${id}`); setError("");
    const response = await fetch("/api/admin/dashboard", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "fraud-review", id, decision, password: fraudPassword }),
    });
    const result = await response.json(); setSaving("");
    if (!response.ok) return setError(result.error || "The fraud review could not be updated.");
    setFraudPassword(""); await load();
  }

  async function decideCustomRequest(id: number, decision: "approved" | "declined") {
    setSaving(`custom-${id}`); setError("");
    const response = await fetch("/api/admin/dashboard", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "custom-request-decision", id, decision, password: approvalPassword, confirmation: approvalPhrase, approvedTotal: approvedTotal[id] }),
    });
    const result = await response.json(); setSaving("");
    if (!response.ok) return setError(result.error || "The request could not be updated.");
    setApprovalPassword(""); setApprovalPhrase(""); await load();
  }

  if (!data && recoveryMode) return (
    <main className="adminLogin">
      <form onSubmit={(event) => event.preventDefault()}>
        <span className="adminFlag"><i></i><i></i><i></i></span>
        <p>JEWELRY DEPT.</p><h1>Check your<br /><em>email.</em></h1>
        <p className="recoveryNotice">{securityMessage}</p>
        <small>The link expires in 30 minutes and works once.</small>
        <button className="textButton" type="button" onClick={() => { setRecoveryMode(false); setError(""); }}>BACK TO SIGN IN</button>
      </form>
    </main>
  );

  if (!data) return (
    <main className="adminLogin">
      <form onSubmit={login}>
        <span className="adminFlag"><i></i><i></i><i></i></span>
        <p>JEWELRY DEPT.</p><h1>Management<br /><em>access.</em></h1>
        <label htmlFor="password">Dashboard password</label>
        <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        {error && <small>{error}</small>}
        <button>ENTER DASHBOARD</button>
        <button className="textButton" type="button" onClick={startRecovery} disabled={saving === "recovery"}>{saving === "recovery" ? "SENDING SECURE LINK…" : "FORGOT PASSWORD?"}</button>
      </form>
    </main>
  );

  const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  return (
    <main className="adminShell">
      <aside>
        <div className="adminBrand"><span className="adminFlag"><i></i><i></i><i></i></span><b>JEWELRY<br />DEPT.</b></div>
        <nav>{["overview", "inventory", "photos", "orders", "custom requests", "checkout", "security"].map((item) => <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{item}</button>)}</nav>
        <a href="/" target="_blank">VIEW STOREFRONT ↗</a>
      </aside>
      <section className="adminMain">
        <header><div><p>CONTROL ROOM</p><h1>{tab}</h1></div><div className="live"><span></span>{data.summary.live_visitors} LIVE NOW</div></header>

        {tab === "overview" && <>
          <div className="metricGrid">
            <Metric label="Live visitors" value={String(data.summary.live_visitors)} note={`${data.summary.visitors_today} visitors today`} />
            <Metric label="Product views" value={String(data.summary.product_views_today)} note="Last 24 hours" />
            <Metric label="Added to bag" value={String(data.summary.add_to_cart_today)} note="Last 24 hours" />
            <Metric label="Checkout starts" value={String(data.summary.checkout_starts_today)} note="Last 24 hours" />
            <Metric label="Total orders" value={String(data.summary.total_orders)} note="All-time orders" />
            <Metric label="Gross revenue" value={money(data.summary.gross)} note="Excludes cancelled orders" />
            <Metric label="Average order" value={money(data.summary.average_order)} note="Across all orders" />
            <Metric label="Fraud reviews" value={String(data.summary.fraud_reviews)} note="Orders blocked from shipping" />
          </div>
          <div className="adminPanel"><h2>Inventory attention</h2>{data.products.filter(p => p.inventory <= 5).map(p => <div className="alertRow" key={p.id}><span>{p.name}<small>{p.sku}</small></span><b>{p.inventory} LEFT</b></div>)}</div>
        </>}

        {tab === "inventory" && <div className="adminPanel">
          <div className="panelHead"><div><p>PRODUCT CATALOG</p><h2>Products, photos & inventory</h2></div><div className="catalogActions"><button className="adminAction" onClick={importShopify}>{saving === "shopify-import" ? "IMPORTING…" : "IMPORT SHOPIFY"}</button><button className="adminAction" onClick={addProduct}>{saving === "new-product" ? "ADDING…" : "+ ADD PRODUCT"}</button></div></div>
          {error && <small className="panelError">{error}</small>}
          <div className="productRows">{data.products.map((product, index) => <ProductRow product={product} setData={setData} index={index} save={() => saveProduct(data.products[index])} saving={saving === `product-${product.id}`} key={product.id} />)}</div>
        </div>}

        {tab === "photos" && <div className="adminPanel">
          <div className="panelHead"><div><p>VISUAL CONTENT</p><h2>Website photography</h2></div><span>JPG, PNG or WebP · 2.8 MB max</span></div>
          <div className="assetGrid">{data.assets.map(asset => <article key={asset.id}>
            <div className="assetPreview" style={{ backgroundImage: `url(${asset.data_url || (asset.id === "hero" ? "/images/hero.jpg" : "/images/cuban.jpg")})` }}></div>
            <h3>{asset.label}</h3><p>Last updated {new Date(asset.updated_at).toLocaleDateString()}</p>
            <label>{saving === `asset-${asset.id}` ? "UPLOADING…" : "REPLACE PHOTO"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => upload(asset.id, e.target.files?.[0])} /></label>
          </article>)}</div>
        </div>}

        {tab === "orders" && <div className="adminPanel">
          <div className="panelHead"><div><p>SALES & FRAUD REVIEW</p><h2>Recent orders</h2></div><span>{data.orders.filter(order => order.fulfillment_hold).length} held · {data.orders.length} shown</span></div>
          {data.orders.some(order => order.fulfillment_hold && order.fraud_review_status === "pending") && <div className="fraudNotice">
            <div><b>Suspicious orders are blocked from shipping</b><p>Risk indicators are not proof of fraud. Compare the customer, address, payment, and Stripe Radar details before approving, rejecting, refunding, or contacting the customer.</p></div>
            <label>Dashboard password<input type="password" value={fraudPassword} onChange={event => setFraudPassword(event.target.value)} autoComplete="current-password" placeholder="Required to release an order" /></label>
          </div>}
          {error && <small className="panelError">{error}</small>}
          {data.orders.length ? <div className="orderReviewList">{data.orders.map(order => {
            const riskLevel = order.fraud_risk_level || "not_assessed";
            const riskSignals = Array.isArray(order.fraud_signals) ? order.fraud_signals : [];
            const pendingReview = Boolean(order.fulfillment_hold && order.fraud_review_status === "pending");
            const blocked = order.fraud_review_status === "rejected" || order.fraud_review_status === "disputed";
            return <article className={`orderReviewCard ${order.fulfillment_hold ? "held" : ""}`} key={order.id}>
              <div className="orderReviewHead">
                <div><span>ORDER #{order.id}</span><h3>{order.customer_name}</h3><p>{order.customer_email}</p></div>
                <div className="orderValue"><strong>{money(order.total)}</strong><b className={`riskBadge risk-${riskLevel.replace("_", "-")}`}>{riskLevel.replace("_", " ")} risk{order.fraud_risk_score == null ? "" : ` · ${order.fraud_risk_score}/100`}</b></div>
              </div>
              <div className="orderMeta"><span>{new Date(order.created_at).toLocaleString()}</span><span>ORDER: {order.status}</span><span>REVIEW: {order.fraud_review_status || "clear"}</span></div>
              {riskSignals.length > 0 && <ul className="riskSignals">{riskSignals.map((signal, index) => <li key={index}>{signal}</li>)}</ul>}
              <div className="orderActions">
                {pendingReview ? <div className="fraudDecisionButtons">
                  <button disabled={saving === `fraud-${order.id}`} onClick={() => reviewFraudOrder(order.id, "approve")}>APPROVE FULFILLMENT</button>
                  <button className="fraudReject" disabled={saving === `fraud-${order.id}`} onClick={() => reviewFraudOrder(order.id, "reject")}>MARK SUSPECTED FRAUD</button>
                </div> : blocked ? <small className="blockedOrder">DO NOT SHIP · Handle any refund or dispute directly in Stripe.</small> : <span className="labelActions">
                  {order.label_url ? <a href={order.label_url} target="_blank">PRINT LABEL</a> : <button disabled={saving === `label-${order.id}`} onClick={() => createLabel(order.id)}>{saving === `label-${order.id}` ? "LOADING…" : "GET LABEL"}</button>}
                  {order.tracking_number && <small>{order.tracking_number}</small>}
                </span>}
              </div>
            </article>;
          })}</div> : <div className="emptyState"><b>No orders recorded yet.</b><p>Orders will appear here when checkout is connected.</p></div>}
        </div>}

        {tab === "custom requests" && <div className="adminPanel customRequestPanel">
          <div className="panelHead"><div><p>GOLD QUOTE APPROVALS</p><h2>Custom piece requests</h2></div><span>{data.customRequests.filter(request => request.status === "pending").length} pending</span></div>
          <div className="approvalNotice"><b>Double verification is required</b><p>Enter the dashboard password and the exact approval phrase shown on the request. No custom request can be purchased before approval.</p></div>
          {error && <small className="panelError">{error}</small>}
          {data.customRequests.length ? <div className="customRequestList">{data.customRequests.map(request => <article key={request.id}>
            <div className="requestHead"><div><span>REQUEST #{request.id}</span><h3>{request.customer_name}</h3><p>{request.customer_email}{request.customer_phone ? ` · ${request.customer_phone}` : ""}</p></div><b className={`requestStatus ${request.status}`}>{request.status}</b></div>
            <p className="requestDescription">{request.description}</p>
            <div className="quoteBreakdown"><span>{request.karat} gold</span><span>{Number(request.grams)} grams</span><span>{request.stone}</span><span>{request.complexity}</span></div>
            <dl><div><dt>Gold market at request</dt><dd>{money(Number(request.spot_price))}/oz</dd></div><div><dt>Pure metal value</dt><dd>{money(Number(request.metal_cost))}</dd></div><div><dt>15% sourcing & waste</dt><dd>{money(Number(request.metal_allowance))}</dd></div><div><dt>Craftsmanship</dt><dd>{money(Number(request.craftsmanship))}</dd></div><div><dt>Customer estimate</dt><dd>{money(Number(request.estimated_total))}</dd></div></dl>
            {request.status === "pending" ? <div className="approvalControls">
              <label>Final approved total<input type="number" min="1" value={approvedTotal[request.id] ?? Number(request.estimated_total)} onChange={event => setApprovedTotal(current => ({ ...current, [request.id]: Number(event.target.value) }))} /></label>
              <label>Dashboard password<input type="password" value={approvalPassword} onChange={event => setApprovalPassword(event.target.value)} autoComplete="current-password" /></label>
              <label>Second verification<input value={approvalPhrase} onChange={event => setApprovalPhrase(event.target.value)} placeholder={`Type APPROVE ${request.id}`} /></label>
              <div><button disabled={saving === `custom-${request.id}`} onClick={() => decideCustomRequest(request.id, "approved")}>APPROVE REQUEST</button><button className="decline" disabled={saving === `custom-${request.id}`} onClick={() => decideCustomRequest(request.id, "declined")}>DECLINE</button></div>
            </div> : <p className="decisionRecord">Reviewed {request.approved_total ? `· final total ${money(Number(request.approved_total))}` : ""}</p>}
          </article>)}</div> : <div className="emptyState"><b>No custom requests yet.</b><p>New custom gold quote requests will appear here automatically.</p></div>}
        </div>}

        {tab === "checkout" && <div className="adminPanel checkoutPanel">
          <div className="panelHead"><div><p>STRIPE CHECKOUT</p><h2>Payment activation</h2></div><span>{data.stripeReady ? "Stripe is connected" : "Stripe connection required"}</span></div>
          <div className="checkoutStatus">
            <div><span className={data.checkoutEnabled ? "statusOn" : "statusOff"}></span><div><b>{data.checkoutEnabled ? "CHECKOUT IS LIVE" : "CHECKOUT IS OFF"}</b><p>{data.checkoutEnabled ? "Customers can complete purchases." : "No customer payments can be accepted yet."}</p></div></div>
            <button onClick={toggleCheckout} disabled={!data.stripeReady || saving === "checkout"}>{saving === "checkout" ? "UPDATING…" : data.checkoutEnabled ? "TURN OFF CHECKOUT" : "ACTIVATE CHECKOUT"}</button>
          </div>
          <div className="launchChecklist">
            <div className={data.stripeReady ? "ready" : "missing"}><span>{data.stripeReady ? "✓" : "!"}</span><p><b>PAYMENTS</b><small>{data.stripeReady ? "Stripe key and webhook connected" : "Stripe key and webhook required"}</small></p></div>
            <div className={data.shippoReady ? "ready" : "missing"}><span>{data.shippoReady ? "✓" : "!"}</span><p><b>SHIPPING</b><small>{data.shippoReady ? "Shippo and return address connected" : "Shippo or return address incomplete"}</small></p></div>
            <div className={data.emailReady ? "ready" : "missing"}><span>{data.emailReady ? "✓" : "!"}</span><p><b>EMAIL</b><small>{data.emailReady ? "Customer messages connected" : "Resend email connection required"}</small></p></div>
          </div>
          {!data.stripeReady && <div className="setupNotice"><b>Stripe setup needed</b><p>Connect your Stripe account and webhook before this switch can be activated.</p></div>}
          {error && <small className="panelError">{error}</small>}
        </div>}

        {tab === "security" && <div className="securityStack">
        <div className="adminPanel securityPanel">
          <div className="panelHead"><div><p>MANAGEMENT ACCESS</p><h2>Set a new password</h2></div><span>Your password is encrypted before storage</span></div>
          <form onSubmit={changePassword}>
            <label>New password<input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={10} autoComplete="new-password" /></label>
            <label>Confirm new password<input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={10} autoComplete="new-password" /></label>
            <small className={passwordMessage.includes("successfully") ? "success" : ""}>{passwordMessage || "Use at least 10 characters."}</small>
            <button disabled={saving === "password"}>{saving === "password" ? "UPDATING…" : "UPDATE PASSWORD"}</button>
          </form>
        </div>
        <div className="adminPanel securityPanel">
          <div className="panelHead"><div><p>PASSWORD RECOVERY</p><h2>Security question</h2></div><span>Used only if you forget your password</span></div>
          <form onSubmit={saveRecoveryQuestion}>
            <label>Security question<input type="text" value={securityQuestion} onChange={e => setSecurityQuestion(e.target.value)} placeholder="Example: What was the name of my first pet?" required minLength={8} /></label>
            <label>Security answer<input type="password" value={securityAnswer} onChange={e => setSecurityAnswer(e.target.value)} placeholder="Enter an answer you will remember" required minLength={3} autoComplete="off" /></label>
            <small className={securityMessage.includes("successfully") ? "success" : ""}>{securityMessage || "Answers are not case-sensitive."}</small>
            <button>SAVE SECURITY QUESTION</button>
          </form>
        </div>
        </div>}
      </section>
    </main>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <article className="metric"><p>{label}</p><strong>{value}</strong><span>{note}</span></article>;
}

function ProductRow({ product, setData, index, save, saving }: { product: DashboardData["products"][number]; setData: React.Dispatch<React.SetStateAction<DashboardData | null>>; index: number; save: () => void; saving: boolean }) {
  const change = (key: string, value: string | number | boolean) => setData(current => {
    if (!current) return current;
    const products = [...current.products]; products[index] = { ...products[index], [key]: value };
    return { ...current, products };
  });
  const uploadProductImage = (file?: File) => { if (!file || file.size > 2_800_000) return; const reader = new FileReader(); reader.onload = () => change("image_url", String(reader.result)); reader.readAsDataURL(file); };
  return <div className="productRow">
    <div className="productThumb" style={{backgroundImage:`url(${product.image_url || "/images/cuban.jpg"})`}}><label>PHOTO<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => uploadProductImage(e.target.files?.[0])}/></label></div>
    <div className="productFields"><input value={product.name} onChange={e => change("name", e.target.value)} aria-label="Product name" /><input value={product.sku} onChange={e => change("sku", e.target.value)} aria-label="SKU" /><textarea value={product.description || ""} onChange={e => change("description", e.target.value)} placeholder="Product description" /></div>
    <label>$<input type="number" min="0" value={product.price} onChange={e => change("price", Number(e.target.value))} aria-label="Price" /></label>
    <label>QTY<input type="number" min="0" value={product.inventory} onChange={e => change("inventory", Number(e.target.value))} aria-label="Inventory" /></label>
    <label className="activeToggle"><input type="checkbox" checked={product.active} onChange={e => change("active", e.target.checked)} />VISIBLE</label>
    <button onClick={save}>{saving ? "SAVING…" : "SAVE"}</button>
  </div>;
}
