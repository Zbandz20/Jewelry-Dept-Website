import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ensureAdminTables, getSql } from "@/lib/admin";

type Product = { id: number; name: string; sku: string; price: number; inventory: number; image_url: string; description: string };

async function productById(id: number): Promise<Product | null> {
  if (!Number.isInteger(id) || id < 1) return null;
  await ensureAdminTables();
  const rows = await getSql()`SELECT id, name, sku, price, inventory, image_url, description FROM jd_products WHERE id = ${id} AND active = TRUE LIMIT 1`;
  if (!rows[0]) return null;
  return { ...rows[0], id: Number(rows[0].id), price: Number(rows[0].price), inventory: Number(rows[0].inventory) } as Product;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const product = await productById(Number((await params).id));
  return {
    title: product ? `${product.name} — Jewelry Dept.` : "Product — Jewelry Dept.",
    description: product?.description || "Jewelry Dept. product details.",
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const product = await productById(Number((await params).id));
  if (!product) notFound();
  return (
    <main className="productPage">
      <nav className="simpleNav"><a href="/">JEWELRY DEPT.</a><a href="/#pieces">BACK TO SHOP</a></nav>
      <section className="productDetail">
        <div className="productDetailImage"><img src={product.image_url || "/images/cuban.jpg"} alt={product.name} /></div>
        <div className="productDetailInfo">
          <p className="eyebrow">JEWELRY DEPT. COLLECTION</p>
          <h1>{product.name}</h1>
          <p className="productPrice">${product.price.toLocaleString()}</p>
          <p className="productDescription">{product.description || "Hand-finished by Jewelry Dept."}</p>
          <div className="detailBadges"><span>SOLID 925 STERLING SILVER</span><span>MOISSANITE STONES</span></div>
          <div className={product.inventory > 0 ? "stockStatus available" : "stockStatus"}>{product.inventory > 0 ? `${product.inventory} ready to ship` : "Currently sold out"}</div>
          <a className="primary productBack" href="/#pieces">{product.inventory > 0 ? "ADD FROM SHOPPING PAGE →" : "VIEW OTHER PIECES →"}</a>
          <dl className="productFacts">
            <div><dt>Materials</dt><dd>Solid 925 sterling silver and moissanite</dd></div>
            <div><dt>Authenticity</dt><dd>Inspected by Jewelry Dept.</dd></div>
            <div><dt>Shipping</dt><dd>{product.price > 100 ? "Free standard shipping" : "$9.95 standard shipping"}</dd></div>
            <div><dt>Returns</dt><dd>Eligible in-stock items: 30 days</dd></div>
          </dl>
          <section className="careCard"><h2>Care instructions</h2><p>Store separately in a dry pouch. Avoid chlorine, harsh chemicals, and abrasive cleaners. Wipe gently with a soft jewelry cloth after wear.</p></section>
          <small>SKU: {product.sku || `JD-${product.id}`}</small>
        </div>
      </section>
    </main>
  );
}
