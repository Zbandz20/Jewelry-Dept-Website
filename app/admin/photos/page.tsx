"use client";

import { useEffect, useState } from "react";
import "./admin.css";

type DashboardData = {
  summary: { total_orders: number; gross: number; live_visitors: number; visitors_today: number; average_order: number };
  products: Array<{ id: number; name: string; sku: string; price: number; inventory: number; active: boolean }>;
  orders: Array<{ id: number; customer_name: string; customer_email: string; total: number; status: string; created_at: string }>;
  assets: Array<{ id: string; label: string; data_url: string; updated_at: string }>;
};

export default function AdminPhotos() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");
  const [saving, setSaving] = useState("");

  async function load() {
    const response = await fetch("/api/admin/dashboard", { cache: "no-store" });
    if (response.ok) setData(await response.json());
  }
  useEffect(() => { load(); const timer = setInterval(load, 30000); return () => clearInterval(timer); }, []);

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

  if (!data) return (
    <main className="adminLogin">
      <form onSubmit={login}>
        <span className="adminFlag"><i></i><i></i><i></i></span>
        <p>JEWELRY DEPT.</p><h1>Management<br /><em>access.</em></h1>
        <label htmlFor="password">Dashboard password</label>
        <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        {error && <small>{error}</small>}
        <button>ENTER DASHBOARD</button>
      </form>
    </main>
  );

  const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  return (
    <main className="adminShell">
      <aside>
        <div className="adminBrand"><span className="adminFlag"><i></i><i></i><i></i></span><b>JEWELRY<br />DEPT.</b></div>
        <nav>{["overview", "inventory", "photos", "orders"].map((item) => <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{item}</button>)}</nav>
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
          <div className="panelHead"><div><p>PRODUCT CATALOG</p><h2>Inventory & pricing</h2></div><span>Changes update your management database</span></div>
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
          {data.orders.length ? <div className="orderTable">{data.orders.map(order => <div key={order.id}><b>#{order.id}</b><span>{order.customer_name}<small>{order.customer_email}</small></span><span>{new Date(order.created_at).toLocaleDateString()}</span><strong>{money(order.total)}</strong><em>{order.status}</em></div>)}</div> : <div className="emptyState"><b>No orders recorded yet.</b><p>Orders will appear here when checkout is connected.</p></div>}
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
  return <div className="productRow">
    <input value={product.name} onChange={e => change("name", e.target.value)} aria-label="Product name" />
    <input value={product.sku} onChange={e => change("sku", e.target.value)} aria-label="SKU" />
    <label>$<input type="number" value={product.price} onChange={e => change("price", Number(e.target.value))} aria-label="Price" /></label>
    <label>QTY<input type="number" value={product.inventory} onChange={e => change("inventory", Number(e.target.value))} aria-label="Inventory" /></label>
    <button onClick={save}>{saving ? "SAVING…" : "SAVE"}</button>
  </div>;
}
