"use client";

import { useState } from "react";

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
        <div className="heroImage" />
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
          <img src="/images/cuban.jpg" alt="La Corona iced Cuban-link chain in yellow gold" />
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
                <img src="/images/cuban.jpg" alt="" />
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
      <span className="flagMark" aria-hidden="true"><b></b><b></b><b></b></span>
      <span>JEWELRY <i>DEPT.</i></span>
    </a>
  );
}
