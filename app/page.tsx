"use client";

import { useEffect, useRef, useState } from "react";

type Product = { id: number; name: string; description: string; price: number; inventory: number; image_url: string };
const fallbackProducts: Product[] = [
  { id: -1, name: "6mm Moissanite Cuban Bracelet", description: "Authentic 6mm Moissanite Cuban Bracelet from Jewelry Dept.", price: 250, inventory: 0, image_url: "https://jewelrydeptaz.myshopify.com/cdn/shop/files/AAD37993-02AD-4948-BF25-D7A330AC1D91.jpg?v=1772470224&width=1200" },
];

export default function Home() {
  const [cartItems, setCartItems] = useState<number[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [siteImages, setSiteImages] = useState({ hero: "/images/hero.jpg", featured: "/images/cuban.jpg" });
  const [checkoutEnabled, setCheckoutEnabled] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [products, setProducts] = useState<Product[]>(fallbackProducts);
  const [goldPricing, setGoldPricing] = useState<any>(null);
  const [customForm, setCustomForm] = useState({ name: "", email: "", phone: "", description: "", karat: "14K", grams: 10, stone: "Moissanite", complexity: "detailed" });
  const [customBusy, setCustomBusy] = useState(false);
  const [customMessage, setCustomMessage] = useState("");
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterMessage, setNewsletterMessage] = useState("");
  const [newsletterBusy, setNewsletterBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const cart = cartItems.length;
  const cartLines = products.map(product => ({ ...product, quantity: cartItems.filter(id => id === product.id).length })).filter(product => product.quantity > 0);
  const cartTotal = cartLines.reduce((total, product) => total + product.price * product.quantity, 0);
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
    const refreshMetals = () => fetch("/api/custom-quote")
      .then(response => response.ok ? response.json() : null)
      .then(result => { if (result) setGoldPricing(result); })
      .catch(() => {});
    refreshMetals();
    const metalTimer = window.setInterval(refreshMetals, 300_000);
    return () => window.clearInterval(metalTimer);
  }, []);

  useEffect(() => {
    if (!menu) return;
    function closeOutside(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenu(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [menu]);

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

  async function submitCustomRequest(event: React.FormEvent) {
    event.preventDefault();
    setCustomBusy(true); setCustomMessage("");
    const response = await fetch("/api/custom-quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(customForm) });
    const result = await response.json(); setCustomBusy(false);
    if (!response.ok) return setCustomMessage(result.error || "Your request could not be sent.");
    setCustomMessage(`Request #${result.request.id} received. No payment was taken. We will review and approve your final quote.`);
    setCustomForm(current => ({ ...current, description: "" }));
  }

  async function joinNewsletter(event: React.FormEvent) {
    event.preventDefault();
    setNewsletterMessage("");
    setNewsletterBusy(true);
    const response = await fetch("/api/newsletter", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newsletterEmail }),
    });
    const result = await response.json();
    setNewsletterBusy(false);
    setNewsletterMessage(result.message || result.error || "Signup could not be completed.");
    if (response.ok) setNewsletterEmail("");
  }

  const goldMarket = goldPricing?.metals?.gold || goldPricing?.market;
  const silverMarket = goldPricing?.metals?.silver;
  const spot = Number(goldMarket?.price || 0);
  const purity = Number(goldPricing?.purity?.[customForm.karat] || 0);
  const craft = goldPricing?.craftsmanship?.[customForm.complexity];
  const metalCost = spot ? (spot / 31.1034768) * Number(customForm.grams) * purity : 0;
  const metalAllowance = metalCost * 0.15;
  const craftCost = craft ? Math.max(Number(craft.minimum), Number(customForm.grams) * Number(craft.perGram)) : 0;
  const customEstimate = Math.ceil((metalCost + metalAllowance + craftCost) / 5) * 5;
  const formatMarketPrice = (value: unknown, digits = 2) => {
    const price = Number(value);
    return Number.isFinite(price) && price > 0
      ? price.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits })
      : "—";
  };
  const marketUpdated = goldMarket?.updatedAt || silverMarket?.updatedAt;
  const marketUpdatedDate = marketUpdated ? new Date(marketUpdated) : null;
  const marketUpdatedLabel = marketUpdatedDate && !Number.isNaN(marketUpdatedDate.getTime())
    ? marketUpdatedDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "Loading current market";

  return (
    <main>
      <div className="ticker">
        <div className="tickerTrack">
          {[0, 1].map((copy) => (
            <div className="tickerGroup" aria-hidden={copy === 1} key={copy}>
              <span>CUSTOMS</span><b>◆</b>
              <span>925 SILVER · 10K · 14K · 18K · 24K GOLD</span><b>◆</b>
              <span>NATURAL DIAMONDS · LAB DIAMONDS · MOISSANITE</span><b>◆</b>
              <span>MADE TO ORDER</span><b>◆</b>
            </div>
          ))}
        </div>
      </div>

      <nav className="nav">
        {menu && <button className="menuDismiss" onClick={() => setMenu(false)} aria-label="Close navigation menu" />}
        <div className="menuCluster" ref={menuRef}>
          <button className="menuButton" onClick={() => setMenu(open => !open)} aria-label="Toggle navigation" aria-expanded={menu}>MENU</button>
          <div className={`navlinks ${menu ? "open" : ""}`}>
            <a href="#drop" onClick={() => setMenu(false)}>FEATURED</a>
            <a href="#pieces" onClick={() => setMenu(false)}>SHOP ALL</a>
            <a href="#reviews" onClick={() => setMenu(false)}>REVIEWS</a>
            <a href="#custom" onClick={() => setMenu(false)}>CUSTOM</a>
            <a href="#proof" onClick={() => setMenu(false)}>THE STONE</a>
          </div>
        </div>
        <Logo clipId="navJewelryLogo" />
        <button className="cart" onClick={() => setCartOpen(true)} aria-label={`Open bag with ${cart} items`}>BAG <span>{cart}</span></button>
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

      <section className="metalMarket" aria-labelledby="metal-market-heading">
        <div className="metalMarketIntro">
          <p className="eyebrow">CURRENT METALS · USD</p>
          <h2 id="metal-market-heading">Gold &amp; silver<br /><em>market reference.</em></h2>
          <p>Spot prices update automatically about every five minutes. Finished jewelry pricing also includes purity, weight, sourcing, casting, stone setting, craftsmanship, taxes, and shipping.</p>
          <span>UPDATED {marketUpdatedLabel.toUpperCase()}</span>
        </div>
        <div className="metalQuotes" aria-live="polite">
          <article className="goldQuote">
            <div><span className="metalSymbol">AU</span><p>GOLD <small>XAU</small></p></div>
            <strong>{formatMarketPrice(goldMarket?.price)}</strong>
            <p>PER TROY OUNCE</p>
            <div className="metalQuoteFoot"><b>{formatMarketPrice(goldMarket?.pricePerGram)} / GRAM</b><span className={goldMarket?.live ? "marketLive" : "marketReference"}>{goldMarket?.live ? "LIVE MARKET" : "REFERENCE PRICE"}</span></div>
          </article>
          <article className="silverQuote">
            <div><span className="metalSymbol">AG</span><p>SILVER <small>XAG</small></p></div>
            <strong>{formatMarketPrice(silverMarket?.price)}</strong>
            <p>PER TROY OUNCE</p>
            <div className="metalQuoteFoot"><b>{formatMarketPrice(silverMarket?.pricePerGram)} / GRAM</b><span className={silverMarket?.live ? "marketLive" : "marketReference"}>{silverMarket?.live ? "LIVE MARKET" : "REFERENCE PRICE"}</span></div>
          </article>
        </div>
      </section>

      <section className="featured" id="drop">
        <div className="productVisual">
          <img src={featuredProduct.image_url || siteImages.featured} alt={featuredProduct.name} />
          <span className="dropTag">DROP 05 · LIMITED</span>
        </div>
        <div className="featuredInfo">
          <p className="eyebrow">FEATURED — THE DROP</p>
          <h2>{featuredProduct.name}</h2>
          <p>{featuredProduct.description || "Hand-finished jewelry, made to stand out."}</p>
          <div className="inventoryMaterial"><b>SOLID 925 STERLING SILVER</b><span>MOISSANITE STONES</span></div>
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
              <a className={`cardImage crop${index + 1}`} href={`/products/${product.id}`} aria-label={`View details for ${product.name}`}>
                <img src={product.image_url || siteImages.featured} alt={product.name} />
                <span>{product.inventory > 0 ? `${product.inventory} AVAILABLE` : "SOLD OUT"}</span>
              </a>
              <div className="cardTop"><h3><a href={`/products/${product.id}`}>{product.name}</a></h3><strong>${product.price.toLocaleString()}</strong></div>
              <p>{product.description || "Hand-finished by Jewelry Dept."}</p>
              <button disabled={product.inventory < 1} onClick={() => setCartItems(items => [...items, product.id])}>{product.inventory < 1 ? "SOLD OUT" : "ADD TO BAG"} <span>{product.inventory < 1 ? "" : "+"}</span></button>
            </article>
          ))}
        </div>
      </section>


      <section className="proof" id="proof">
        <div className="stoneIntro">
          <p className="eyebrow">CHOOSE YOUR STONE</p>
          <h2>Natural, lab<br /><em>or moissanite?</em></h2>
          <p>Each option has its own look, story, and price point. Compare the details below and choose what matters most to you.</p>
        </div>
        <div className="stoneCards">
          <article>
            <span>01</span><h3>Moissanite</h3>
            <p>A lab-created gemstone known for intense brilliance and colorful fire. It is not a diamond, but it is exceptionally durable and gives the biggest visual impact for the price.</p>
            <dl><div><dt>Hardness</dt><dd>9.25 Mohs</dd></div><div><dt>Look</dt><dd>Maximum rainbow fire</dd></div><div><dt>Best for</dt><dd>Bold sparkle and value</dd></div></dl>
          </article>
          <article>
            <span>02</span><h3>Lab Diamond</h3>
            <p>A real diamond grown in a controlled laboratory. It has the same carbon crystal structure, hardness, and optical properties as a mined diamond.</p>
            <dl><div><dt>Hardness</dt><dd>10 Mohs</dd></div><div><dt>Look</dt><dd>Classic diamond brilliance</dd></div><div><dt>Best for</dt><dd>Diamond quality at a lower price</dd></div></dl>
          </article>
          <article>
            <span>03</span><h3>Natural Diamond</h3>
            <p>Created deep within the earth over billions of years and then mined. Every stone carries natural rarity, traditional prestige, and its own geological history.</p>
            <dl><div><dt>Hardness</dt><dd>10 Mohs</dd></div><div><dt>Look</dt><dd>Classic diamond brilliance</dd></div><div><dt>Best for</dt><dd>Rarity, tradition, and provenance</dd></div></dl>
          </article>
        </div>
        <div className="stoneTable">
          <div className="stoneTableHead"><strong>DETAIL</strong><strong>MOISSANITE</strong><strong>LAB DIAMOND</strong><strong>NATURAL DIAMOND</strong></div>
          <div><span>Origin</span><b>Created in a lab</b><b>Grown in a lab</b><b>Formed in the earth</b></div>
          <div><span>Material</span><b>Silicon carbide</b><b>Crystallized carbon</b><b>Crystallized carbon</b></div>
          <div><span>Sparkle</span><b>Most colorful fire</b><b>Classic diamond fire</b><b>Classic diamond fire</b></div>
          <div><span>Durability</span><b>Excellent for daily wear</b><b>Highest hardness</b><b>Highest hardness</b></div>
          <div><span>Price profile</span><b>Most accessible</b><b>Lower than natural</b><b>Premium for rarity</b></div>
        </div>
        <p className="stoneNote">Prices vary by size, cut, color, clarity, metal, and setting. We can source and set all three options for custom pieces.</p>
        <a className="primary stoneCta" href="#custom">START A CUSTOM PIECE</a>
      </section>

      <section className="custom" id="custom">
        <div className="customIntro">
          <p className="eyebrow">05 / CUSTOM GOLD DEPT.</p>
          <h2>Your idea.<br /><em>Priced responsibly.</em></h2>
          <p>Custom gold requests use the current gold market, karat purity, estimated finished weight, a 15% sourcing and casting allowance, and craftsmanship. This is an estimate only—no payment can be made until Jewelry Dept. reviews and approves the final quote.</p>
          <div className="marketPrice"><span>GOLD MARKET</span><b>{spot ? "$" + spot.toLocaleString(undefined, { maximumFractionDigits: 2 }) + " / TROY OZ" : "LOADING…"}</b><small>{goldPricing?.market?.live ? "Live market · refreshed every 5 minutes" : "Protected fallback price"}</small></div>
          <div className="steps"><div><b>01</b><span>Submit design and estimated weight</span></div><div><b>02</b><span>Management verifies and approves</span></div><div><b>03</b><span>Final quote and payment link</span></div></div>
        </div>
        <form className="customQuoteForm" onSubmit={submitCustomRequest}>
          <div className="customFields"><label>Name<input required value={customForm.name} onChange={event => setCustomForm({...customForm, name:event.target.value})} /></label><label>Email<input required type="email" value={customForm.email} onChange={event => setCustomForm({...customForm, email:event.target.value})} /></label><label>Phone<input value={customForm.phone} onChange={event => setCustomForm({...customForm, phone:event.target.value})} /></label><label>Estimated finished weight (grams)<input required type="number" min="1" max="1000" step=".1" value={customForm.grams} onChange={event => setCustomForm({...customForm, grams:Number(event.target.value)})} /></label></div>
          <label>Gold purity<select value={customForm.karat} onChange={event => setCustomForm({...customForm, karat:event.target.value})}><option>10K</option><option>14K</option><option>18K</option><option>24K</option></select></label>
          <label>Craftsmanship<select value={customForm.complexity} onChange={event => setCustomForm({...customForm, complexity:event.target.value})}><option value="classic">Classic / simple — $35 per gram, $150 minimum</option><option value="detailed">Detailed custom — $55 per gram, $250 minimum</option><option value="pave">Pavé / stone intensive — $85 per gram, $400 minimum</option></select></label>
          <label>Stone choice<select value={customForm.stone} onChange={event => setCustomForm({...customForm, stone:event.target.value})}><option>No stones</option><option>Moissanite</option><option>Lab diamond</option><option>Natural diamond</option></select></label>
          <label>Describe the piece<textarea required value={customForm.description} onChange={event => setCustomForm({...customForm, description:event.target.value})} placeholder="Piece type, dimensions, inspiration, stone sizes, engraving, and anything else we should know." /></label>
          <div className="estimateBox"><span>ESTIMATED CUSTOM GOLD TOTAL</span><strong>{customEstimate ? "$" + customEstimate.toLocaleString() : "—"}</strong><small>Includes estimated gold value, 15% sourcing/casting allowance, and craftsmanship. Stones, CAD, taxes, and shipping may change the final approved quote.</small></div>
          <button className="primary" disabled={customBusy}>{customBusy ? "SENDING REQUEST…" : "REQUEST MANAGEMENT APPROVAL →"}</button>
          {customMessage && <p className="customMessage">{customMessage}</p>}
        </form>
      </section>

      <section className="marketplaceReviews" id="reviews">
        <div className="reviewsHeading">
          <div>
            <p className="eyebrow">FACEBOOK MARKETPLACE FEEDBACK</p>
            <h2>Trusted locally.<br /><em>Rated by real buyers.</em></h2>
          </div>
          <div className="ratingSummary" aria-label="4.9 out of 5 stars based on 54 Facebook Marketplace ratings">
            <strong>4.9</strong>
            <div><span aria-hidden="true">★★★★★</span><p>54 SELLER RATINGS</p></div>
          </div>
        </div>
        <div className="reviewStrengths" aria-label="Top qualities buyers appreciate">
          <span>COMMUNICATION · 38</span>
          <span>PRICING · 37</span>
          <span>PUNCTUALITY · 31</span>
          <span>ITEM DESCRIPTION · 30</span>
        </div>
        <div className="reviewGrid">
          <figure>
            <div className="reviewStars" aria-label="5 out of 5 stars">★★★★★</div>
            <blockquote>“Best quality out there and prices.”</blockquote>
            <figcaption><b>Edgar</b><span>Facebook Marketplace reviewer · July 2026</span></figcaption>
          </figure>
          <figure>
            <div className="reviewStars" aria-label="5 out of 5 stars">★★★★★</div>
            <blockquote>“Purchase was amazing—made everything easy and efficient… will come back for more.”</blockquote>
            <figcaption><b>Chris</b><span>Facebook Marketplace reviewer · July 2026</span></figcaption>
          </figure>
          <figure>
            <div className="reviewStars" aria-label="5 out of 5 stars">★★★★★</div>
            <blockquote>“Great quality.”</blockquote>
            <figcaption><b>Braden</b><span>Facebook Marketplace reviewer · July 2026</span></figcaption>
          </figure>
        </div>
        <div className="reviewFooter">
          <p>Seller rating and feedback verified on Facebook Marketplace.</p>
          <a href="https://www.facebook.com/marketplace/profile/100091377385021/" target="_blank" rel="noreferrer">VIEW OUR MARKETPLACE PROFILE ↗</a>
        </div>
      </section>

      <section className="signup">
        <p className="eyebrow">PRIVATE CLIENT LIST</p>
        <h2>First access.<br /><em>No restocks.</em></h2>
        <form onSubmit={joinNewsletter}>
          <label className="srOnly" htmlFor="email">Email address</label>
          <input id="email" type="email" placeholder="YOUR EMAIL" value={newsletterEmail} onChange={event => setNewsletterEmail(event.target.value)} required />
          <button type="submit" disabled={newsletterBusy}>{newsletterBusy ? "JOINING…" : "JOIN THE LIST →"}</button>
          {newsletterMessage && <small className="newsletterMessage" role="status">{newsletterMessage}</small>}
        </form>
      </section>

      {cartOpen && <div className="cartOverlay" onClick={() => setCartOpen(false)}>
        <aside className="cartDrawer" role="dialog" aria-modal="true" aria-label="Shopping bag" onClick={event => event.stopPropagation()}>
          <div className="cartDrawerHead"><div><p>YOUR BAG</p><h2>{cart} {cart === 1 ? "piece" : "pieces"}</h2></div><button onClick={() => setCartOpen(false)} aria-label="Close shopping bag">CLOSE ×</button></div>
          <div className="cartLines">
            {cartLines.map(product => <article key={product.id}>
              <img src={product.image_url || siteImages.featured} alt="" />
              <div><h3>{product.name}</h3><p>Quantity {product.quantity}</p><button onClick={() => setCartItems(items => { const index = items.indexOf(product.id); return index < 0 ? items : items.filter((_, itemIndex) => itemIndex !== index); })}>REMOVE ONE</button></div>
              <strong>${(product.price * product.quantity).toLocaleString()}</strong>
            </article>)}
          </div>
          <div className="cartTotal"><span>Estimated total</span><strong>${cartTotal.toLocaleString()}</strong></div>
          <p className="cartNote">{cartTotal > 100 ? "✓ Free standard shipping applied. Taxes are calculated at checkout." : "Standard shipping is $9.95 and will be shown at checkout. Add $" + Math.max(0.01, 100.01 - cartTotal).toFixed(2) + " more for free shipping."}</p>
          {checkoutError && <p className="cartError">{checkoutError}</p>}
          <div className="cartActions"><button className="continueShopping" onClick={() => setCartOpen(false)}>CONTINUE SHOPPING</button><button className="cartCheckout" onClick={startCheckout} disabled={checkoutBusy || cart < 1}>{checkoutBusy ? "OPENING…" : checkoutEnabled ? "SECURE CHECKOUT →" : "CHECKOUT COMING SOON"}</button></div>
        </aside>
      </div>}

      {cart > 0 && <div className="checkoutBar">
        <div><b>{cart} {cart === 1 ? "PIECE" : "PIECES"} · ${cartTotal.toLocaleString()}</b>{checkoutError && <span>{checkoutError}</span>}</div>
        <div className="checkoutBarActions"><button onClick={() => setCartOpen(true)}>VIEW BAG</button><button onClick={startCheckout} disabled={checkoutBusy}>{checkoutBusy ? "OPENING SECURE CHECKOUT…" : checkoutEnabled ? "CHECKOUT →" : "CHECKOUT COMING SOON"}</button></div>
      </div>}

      <footer>
        <Logo clipId="footerJewelryLogo" />
        <p>Fire without compromise.<br />Solid gold. Certified stones. Set by hand.</p>
        <div className="footerLinks"><a href="#pieces">SHOP</a><a href="#custom">CUSTOM</a><a href="mailto:hello@jewelrydept.co">CONTACT</a></div>
        <div className="footerPolicies"><a href="/policies/shipping">SHIPPING</a><a href="/policies/returns">RETURNS</a><a href="/policies/privacy">PRIVACY</a><a href="/policies/terms">TERMS</a></div>
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
      <img src="/images/jewelry-dept-shopify-logo-transparent.png" alt="Jewelry Dept." />
    </a>
  );
}
