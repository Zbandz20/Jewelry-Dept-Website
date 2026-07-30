"use client";

import { useEffect, useState } from "react";

const products = [
  { name: "La Corona", detail: "12mm Cuban · VVS moissanite · 14k gold", price: 1450, tag: "DROP 05" },
  { name: "La Cadena", detail: "10mm Cuban · VVS moissanite · 14k gold", price: 1290, tag: "MADE TO ORDER" },
  { name: "Solitario", detail: "2ct round · D color · 14k white gold", price: 890, tag: "BEST SELLER" },
  { name: "La Cruz", detail: "Full pavé · moissanite · 14k gold", price: 980, tag: "WITH BLESSING" },
];

export default function Home() {
  const [cart, setCart] = useState(0);
  const [stone, setStone] = useState("Moissanite");
  const [gold, setGold] = useState("14K");
  const [menu, setMenu] = useState(false);
  const [siteImages, setSiteImages] = useState({ hero: "/images/hero.jpg", featured: "/images/cuban.jpg" });

  useEffect(() => {
    fetch("/api/site-content").then(response => response.ok ? response.json() : null).then(content => {
      if (content?.assets) setSiteImages(current => ({ ...current, ...content.assets }));
    }).catch(() => {});
    const storageKey = "jd-session";
    let sessionId = sessionStorage.getItem(storageKey);
    if (!sessionId) { sessionId = crypto.randomUUID(); sessionStorage.setItem(storageKey, sessionId); }
    fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId }) }).catch(() => {});
  }, []);

  return (
    <main>
      <div className="ticker">
        <div className="tickerTrack">
          {[0, 1].map((copy) => (
            <div className="tickerGroup" aria-hidden={copy === 1} key={copy}>
              <span>10K · 14K · 18K · 24K GOLD</span><b>◆</b>
              <span>CERTIFIED STONES</span><b>◆</b>
              <span>FREE SHIPPING</span><b>◆</b>
              <span>MADE TO ORDER</span><b>◆</b>
            </div>
          ))}
        </div>
      </div>

      <nav className="nav">
        <button className="menuButton" onClick={() => setMenu(!menu)} aria-label="Toggle navigation">MENU</button>
        <Logo />
        <div className={`navlinks ${menu ? "open" : ""}`}>
          <a href="#drop" onClick={() => setMenu(false)}>THE DROP</a>
          <a href="#pieces" onClick={() => setMenu(false)}>PIECES</a>
          <a href="#custom" onClick={() => setMenu(false)}>CUSTOM</a>
          <a href="#proof" onClick={() => setMenu(false)}>THE STONE</a>
        </div>
        <a className="cart" href="#pieces">BAG <span>{cart}</span></a>
      </nav>

      <header className="hero">
        <div className="heroImage" style={{ backgroundImage: `url(${siteImages.hero})` }} />
        <div className="heroShade" />
        <div className="heroCopy">
          <p className="eyebrow">FIRE WITHOUT COMPROMISE — EST. MMXXVI</p>
          <h1>More fire<br /><em>than a diamond.</em></h1>
          <p className="intro">Moissanite, lab-grown and natural diamonds. Solid gold, 10k–24k. Cut to order and set by hand.</p>
          <div className="actions">
            <a className="primary" href="#drop">ENTER THE DROP</a>
            <a className="secondary" href="#custom">BUILD CUSTOM</a>
          </div>
        </div>
        <div className="heroStat"><strong>2.5×</strong><span>THE FIRE<br />OF A DIAMOND</span></div>
      </header>

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
          <img src={siteImages.featured} alt="La Corona iced Cuban-link chain in yellow gold" />
          <span className="dropTag">DROP 05 · LIMITED</span>
        </div>
        <div className="featuredInfo">
          <p className="eyebrow">FEATURED — THE DROP</p>
          <h2>La Corona<br /><em>Cuban 12mm</em></h2>
          <p>Six hundred hand-set stones on a spine of solid gold. Heavy on the neck, heavier in the room. Built to outlive you.</p>
          <Option label="Stone" items={["Moissanite", "Lab Diamond", "Natural"]} value={stone} setValue={setStone} />
          <Option label="Gold" items={["10K", "14K", "18K", "24K"]} value={gold} setValue={setGold} />
          <div className="buyRow">
            <div><small>FROM</small><strong>$1,450</strong></div>
            <button onClick={() => setCart(cart + 1)}>ADD TO BAG — SHIPS FREE</button>
          </div>
          <div className="assurances"><span>✓ CERTIFIED STONES</span><span>✓ 30-DAY RETURNS</span><span>✓ LIFETIME SERVICE</span></div>
        </div>
      </section>

      <section className="pieces" id="pieces">
        <div className="sectionHeading"><p className="eyebrow">THE COLLECTION</p><h2>Pieces <em>worn loud.</em></h2></div>
        <div className="productGrid">
          {products.map((product, index) => (
            <article className="card" key={product.name}>
              <div className={`cardImage crop${index + 1}`}>
                <img src={siteImages.featured} alt="" />
                <span>{product.tag}</span>
              </div>
              <div className="cardTop"><h3>{product.name}</h3><strong>${product.price.toLocaleString()}</strong></div>
              <p>{product.detail}</p>
              <button onClick={() => setCart(cart + 1)}>ADD TO BAG <span>+</span></button>
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

      <footer>
        <Logo />
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

function Logo() {
  return (
    <a className="wordmark" href="#" aria-label="Jewelry Dept. home">
      <span className="logoType" aria-hidden="true">
        <b>JEWELRY</b>
        <i>DEPT.</i>
        <svg className="mexicanSeal" viewBox="0 0 64 64" role="presentation">
          <path className="sealWreath" d="M12 43c5 10 13 15 20 16M52 43c-5 10-13 15-20 16M15 47l-5-1m9 6-5 1m35-6 5-1m-9 6 5 1" />
          <path className="sealCactus" d="M28 51c0-8 1-14 3-20m5 20c0-7-1-12-3-17m-4 7-5-5m11 6 5-6m-12 4-4 1m12-1 4 1" />
          <path className="sealEagle" d="M30 35c-8-1-14-7-16-16 6 1 11 4 15 8-1-8 2-15 9-20 1 6 0 11-2 16 5-4 10-5 15-3-3 7-8 12-15 14l-1 7-7-1 2-5Z" />
          <path className="sealSnake" d="M38 22c7-3 11 0 8 4-2 3-6 2-8 6" />
          <circle className="sealEye" cx="38.5" cy="17" r="1.4" />
        </svg>
      </span>
    </a>
  );
}
