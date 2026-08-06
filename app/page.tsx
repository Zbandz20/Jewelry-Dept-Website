"use client";

import { useEffect, useState } from "react";

type Product = { id: number; name: string; description: string; price: number; inventory: number; image_url: string };
const fallbackProducts: Product[] = [
  { id: -1, name: "6mm Moissanite Cuban Bracelet", description: "Authentic 6mm Moissanite Cuban Bracelet from Jewelry Dept.", price: 250, inventory: 0, image_url: "https://jewelrydeptaz.myshopify.com/cdn/shop/files/AAD37993-02AD-4948-BF25-D7A330AC1D91.jpg?v=1772470224&width=1200" },
];

export default function Home() {
  const [cartItems, setCartItems] = useState<number[]>([]);
  const [stone, setStone] = useState("Moissanite");
  const [gold, setGold] = useState("14K");
  const [menu, setMenu] = useState(false);
  const [siteImages, setSiteImages] = useState({ hero: "/images/hero.jpg", featured: "/images/cuban.jpg" });
  const [checkoutEnabled, setCheckoutEnabled] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [products, setProducts] = useState<Product[]>(fallbackProducts);
  const cart = cartItems.length;
  const featuredProduct = products[0] || fallbackProducts[0];

  useEffect(() => {
    fetch("/api/site-content").then(response => response.ok ? response.json() : null).then(content => {
      if (content?.assets) setSiteImages(current => ({ ...current, ...content.assets }));
      if (Array.isArray(content?.products) && content.products.length) setProducts(content.products.map((product: Product) => ({ ...product, price: Number(product.price), inventory: Number(product.inventory) })));
      setCheckoutEnabled(Boolean(content?.checkoutEnabled));
    }).catch(() => {});
    const storageKey = "jd-session";
    let sessionId = sessionStorage.getItem(storageKey);
    if (!sessionId) { sessionId = crypto.randomUUID(); sessionStorage.setItem(storageKey, sessionId); }
    fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId }) }).catch(() => {});
  }, []);

  async function startCheckout() {
    setCheckoutError("");
    if (!checkoutEnabled) return setCheckoutError("Checkout is opening soon.");
    const counts = cartItems.reduce<Record<number, number>>((all, id) => ({ ...all, [id]: (all[id] || 0) + 1 }), {});
    setCheckoutBusy(true);
    const response = await fetch("/api/checkout", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: Object.entries(counts).map(([id, quantity]) => ({ id: Number(id), quantity })) }),
    });
    const result = await response.json();
    setCheckoutBusy(false);
    if (!response.ok) return setCheckoutError(result.error || "Checkout could not start.");
    window.location.href = result.url;
  }

  return (
    <main>
      <div className="ticker">
        <div className="tickerTrack">
          {[0, 1].map((copy) => (
            <div className="tickerGroup" aria-hidden={copy === 1} key={copy}>
              <span>WE DO CUSTOM JEWELRY</span><b>◆</b>
              <span>925 SILVER · 10K · 14K · 18K · 24K GOLD</span><b>◆</b>
              <span>NATURAL DIAMONDS · LAB DIAMONDS · MOISSANITE</span><b>◆</b>
              <span>MADE TO ORDER</span><b>◆</b>
            </div>
          ))}
        </div>
      </div>

      <nav className="nav">
        <div className="menuCluster">
          <button className="menuButton" onClick={() => setMenu(!menu)} aria-label="Toggle navigation" aria-expanded={menu}>MENU</button>
          <div className={`navlinks ${menu ? "open" : ""}`}>
            <a href="#drop" onClick={() => setMenu(false)}>THE DROP</a>
            <a href="#pieces" onClick={() => setMenu(false)}>PIECES</a>
            <a href="#custom" onClick={() => setMenu(false)}>CUSTOM</a>
            <a href="#proof" onClick={() => setMenu(false)}>THE STONE</a>
          </div>
        </div>
        <Logo clipId="navJewelryLogo" />
        <a className="cart" href="#pieces">BAG <span>{cart}</span></a>
      </nav>


      <section className="manifesto">
        <span>01 / FEEL</span>
        <h2>You don’t wear it to be seen.<br />You wear it so they <em>never forget.</em></h2>
        <p>Every piece leaves the bench certified, hand-set, and cut to throw light across a room. This isn’t jewelry that whispers. It announces.</p>
      </section>

      <div className="mexicoMarquee" aria-label="Con fe, con fuego, con orgullo">
        <div>
          <span>CON FE.</span><b>◆</b><span>CON FUEGO.</span><b>◆</b><span>CON ORGULLO.</span><b>◆</b>
          <span>CON FE.</span><b>◆</b><span>CON FUEGO.</span><b>◆</b><span>CON ORGULLO.</span><b>◆</b>
        </div>
      </div>

      <section className="featured" id="drop">
        <div className="productVisual">
          <img src={featuredProduct.image_url || siteImages.featured} alt={featuredProduct.name} />
          <span className="dropTag">DROP 05 · LIMITED</span>
        </div>
        <div className="featuredInfo">
          <p className="eyebrow">FEATURED — THE DROP</p>
          <h2>{featuredProduct.name}</h2>
          <p>{featuredProduct.description || "Hand-finished jewelry, made to stand out."}</p>
          <Option label="Stone" items={["Moissanite", "Lab Diamond", "Natural"]} value={stone} setValue={setStone} />
          <Option label="Gold" items={["10K", "14K", "18K", "24K"]} value={gold} setValue={setGold} />
          <div className="buyRow">
            <div><small>FROM</small><strong>${featuredProduct.price.toLocaleString()}</strong></div>
            <button disabled={featuredProduct.inventory < 1} onClick={() => setCartItems(items => [...items, featuredProduct.id])}>{featuredProduct.inventory < 1 ? "SOLD OUT" : "ADD TO BAG — SHIPS FREE"}</button>
          </div>
          <div className="assurances"><span>✓ CERTIFIED STONES</span><span>✓ 30-DAY RETURNS</span><span>✓ LIFETIME SERVICE</span></div>
        </div>
      </section>

      <section className="pieces" id="pieces">
        <div className="sectionHeading"><p className="eyebrow">THE COLLECTION</p><h2>Shop <em>Jewelry Dept.</em></h2></div>
        <div className="productGrid">
          {products.map((product, index) => (
            <article className="card" key={product.name}>
              <div className={`cardImage crop${index + 1}`}>
                <img src={product.image_url || siteImages.featured} alt={product.name} />
                <span>{product.inventory > 0 ? `${product.inventory} AVAILABLE` : "SOLD OUT"}</span>
              </div>
              <div className="cardTop"><h3>{product.name}</h3><strong>${product.price.toLocaleString()}</strong></div>
              <p>{product.description || "Hand-finished by Jewelry Dept."}</p>
              <button disabled={product.inventory < 1} onClick={() => setCartItems(items => [...items, product.id])}>{product.inventory < 1 ? "SOLD OUT" : "ADD TO BAG"} <span>{product.inventory < 1 ? "" : "+"}</span></button>
            </article>
          ))}
        </div>
      </section>

      <section className="proof" id="proof">
        <div>
          <p className="eyebrow">04 / PROOF</p>
          <h2>Moissanite<br /><em>outshines. Literally.</em></h2>
          <p>Optically flawless, certified, and more brilliant than the diamond it’s mistaken for. Prefer the real thing? We set lab-grown and natural diamonds too.</p>
          <a href="#custom">CHOOSE YOUR STONE →</a>
        </div>
        <div className="comparison">
          <div className="compareHead"><span></span><strong>MOISSANITE</strong><strong>DIAMOND</strong></div>
          <Compare label="Fire (dispersion)" a="0.104" b="0.044" />
          <Compare label="Brilliance (RI)" a="2.65–2.69" b="2.42" />
          <Compare label="Hardness" a="9.25" b="10" />
          <Compare label="Price per carat" a="~10%" b="100%" />
        </div>
      </section>

      <section className="custom" id="custom">
        <p className="eyebrow">05 / CUSTOM DEPT.</p>
        <h2>Your idea.<br /><em>Our bench.</em></h2>
        <p>Send a sketch, a photo, or a voice note. We CAD it, you approve the render, and our bench casts and sets it by hand.</p>
        <div className="steps">
          <div><b>01</b><span>Share your reference</span></div>
          <div><b>02</b><span>Approve the render + quote</span></div>
          <div><b>03</b><span>Cast, set, and ship</span></div>
        </div>
        <a className="primary" href="mailto:custom@jewelrydept.co?subject=Custom%20piece%20inquiry">START A CUSTOM PIECE</a>
      </section>

      <section className="signup">
        <p className="eyebrow">PRIVATE CLIENT LIST</p>
        <h2>First access.<br /><em>No restocks.</em></h2>
        <form onSubmit={(event) => event.preventDefault()}>
          <label className="srOnly" htmlFor="email">Email address</label>
          <input id="email" type="email" placeholder="YOUR EMAIL" required />
          <button type="submit">JOIN THE LIST →</button>
        </form>
      </section>

      {cart > 0 && <div className="checkoutBar">
        <div><b>{cart} {cart === 1 ? "PIECE" : "PIECES"} IN YOUR BAG</b>{checkoutError && <span>{checkoutError}</span>}</div>
        <button onClick={startCheckout} disabled={checkoutBusy}>{checkoutBusy ? "OPENING SECURE CHECKOUT…" : checkoutEnabled ? "SECURE CHECKOUT →" : "CHECKOUT COMING SOON"}</button>
      </div>}

      <footer>
        <Logo clipId="footerJewelryLogo" />
        <p>Fire without compromise.<br />Solid gold. Certified stones. Set by hand.</p>
        <div><a href="#pieces">SHOP</a><a href="#custom">CUSTOM</a><a href="mailto:hello@jewelrydept.co">CONTACT</a></div>
        <small>© 2026 JEWELRY DEPT. · ALL RIGHTS RESERVED</small>
      </footer>
    </main>
  );
}

function Option({ label, items, value, setValue }: { label: string; items: string[]; value: string; setValue: (value: string) => void }) {
  return <div className="option"><span>{label}</span><div>{items.map(item => <button className={value === item ? "active" : ""} onClick={() => setValue(item)} key={item}>{item}</button>)}</div></div>;
}

function Compare({ label, a, b }: { label: string; a: string; b: string }) {
  return <div className="compareRow"><span>{label}</span><strong>{a}</strong><span>{b}</span></div>;
}

function Logo({ clipId: _clipId }: { clipId: string }) {
  return (
    <a className="wordmark" href="#" aria-label="Jewelry Dept. home">
      <img src="/images/jewelry-dept-shopify-logo-transparent.png" alt="" aria-hidden="true" />
    </a>
  );
}
