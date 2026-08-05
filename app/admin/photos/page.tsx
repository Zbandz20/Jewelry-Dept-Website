"use client";

import { useEffect, useState } from "react";
import "./admin.css";
import "./security.css";
import "./catalog.css";

type DashboardData = {
  summary: { total_orders: number; gross: number; live_visitors: number; visitors_today: number; average_order: number };
  products: Array<{ id: number; name: string; sku: string; price: number; inventory: number; active: boolean; image_url: string; description: string }>;
  orders: Array<{ id: number; customer_name: string; customer_email: string; total: number; status: string; created_at: string; shipping_address?: { address?: Record<string,string> }; label_url?: string; tracking_number?: string; tracking_url?: string }>;
  assets: Array<{ id: string; label: string; data_url: string; updated_at: string }>;
  checkoutEnabled: boolean;
  stripeReady: boolean;
};

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
    const response = await fetch("/api/admin/recovery", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) return setError(result.error || "Password recovery is not available.");
    setSecurityQuestion(result.question);
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

  if (!data && recoveryMode) return (
    <main className="adminLogin">
      <form onSubmit={recoverPassword}>
        <span className="adminFlag"><i></i><i></i><i></i></span>
        <p>JEWELRY DEPT.</p><h1>Recover<br /><em>access.</em></h1>
        <label>{securityQuestion}</label>
        <input type="text" value={securityAnswer} onChange={(e) => setSecurityAnswer(e.target.value)} autoFocus required autoComplete="off" />
        <label htmlFor="recovery-password">New password</label>
        <input id="recovery-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={10} required />
        <label htmlFor="recovery-confirm">Confirm new password</label>
        <input id="recovery-confirm" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={10} required />
        {error && <small>{error}</small>}
        <button>RESET PASSWORD</button>
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
        <button className="textButton" type="button" onClick={startRecovery}>FORGOT PASSWORD?</button>
      </form>
    </main>
  );

  const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  return (
    <main className="adminShell">
      <aside>
        <div className="adminBrand"><span className="adminFlag"><i></i><i></i><i></i></span><b>JEWELRY<br />DEPT.</b></div>
        <nav>{["overview", "inventory", "photos", "orders", "checkout", "security"].map((item) => <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{item}</button>)}</nav>
        <a href="/" target="_blank">VIEW STOREFRONT ↗</a>
      </aside>
      <section className="adminMain">
        <header><div><p>CONTROL ROOM</p><h1>{tab}</h1></div><div className="live"><span></span>{data.summary.live_visitors} LIVE NOW</div></header>

        {tab === "overview" && <>
          <div className="metricGrid">
            <Metric label="Live visitors" value={String(data.summary.live_visitors)} note={`${data.summary.visitors_today} visitors today`} />
            <Metric label="Total orders" value={String(data.summary.total_orders)} note="All-time orders" />
            <Metric label="Gross revenue" value={money(data.summary.gross)} note="Excludes cancelled orders" />
            <Metric label="Average order" value={money(data.summary.average_order)} note="Across all orders" />
          </div>
          <div className="adminPanel"><h2>Inventory attention</h2>{data.products.filter(p => p.inventory <= 5).map(p => <div className="alertRow" key={p.id}><span>{p.name}<small>{p.sku}</small></span><b>{p.inventory} LEFT</b></div>)}</div>
        </>}

        {tab === "inventory" && <div className="adminPanel">
          <div className="panelHead"><div><p>PRODUCT CATALOG</p><h2>Products, photos & inventory</h2></div><button className="adminAction" onClick={addProduct}>{saving === "new-product" ? "ADDING…" : "+ ADD PRODUCT"}</button></div>
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
          <div className="panelHead"><div><p>SALES</p><h2>Recent orders</h2></div><span>{data.orders.length} records shown</span></div>
          {data.orders.length ? <div className="orderTable">{data.orders.map(order => <div key={order.id}><b>#{order.id}</b><span>{order.customer_name}<small>{order.customer_email}</small></span><span>{new Date(order.created_at).toLocaleDateString()}</span><strong>{money(order.total)}</strong><span className="labelActions">{order.label_url ? <a href={order.label_url} target="_blank">PRINT LABEL</a> : <button disabled={saving === `label-${order.id}`} onClick={() => createLabel(order.id)}>{saving === `label-${order.id}` ? "LOADING…" : "GET LABEL"}</button>}{order.tracking_number && <small>{order.tracking_number}</small>}</span></div>)}</div> : <div className="emptyState"><b>No orders recorded yet.</b><p>Orders will appear here when checkout is connected.</p></div>}
        </div>}

        {tab === "checkout" && <div className="adminPanel checkoutPanel">
          <div className="panelHead"><div><p>STRIPE CHECKOUT</p><h2>Payment activation</h2></div><span>{data.stripeReady ? "Stripe is connected" : "Stripe connection required"}</span></div>
          <div className="checkoutStatus">
            <div><span className={data.checkoutEnabled ? "statusOn" : "statusOff"}></span><div><b>{data.checkoutEnabled ? "CHECKOUT IS LIVE" : "CHECKOUT IS OFF"}</b><p>{data.checkoutEnabled ? "Customers can complete purchases." : "No customer payments can be accepted yet."}</p></div></div>
            <button onClick={toggleCheckout} disabled={!data.stripeReady || saving === "checkout"}>{saving === "checkout" ? "UPDATING…" : data.checkoutEnabled ? "TURN OFF CHECKOUT" : "ACTIVATE CHECKOUT"}</button>
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
