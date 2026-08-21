import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Customer Reviews — Jewelry Dept.",
  description: "Verified Facebook Marketplace feedback and customer ratings for Jewelry Dept.",
};

function Logo() {
  return (
    <a className="wordmark" href="/" aria-label="Jewelry Dept. home">
      <img src="/images/jewelry-dept-shopify-logo-transparent.png" alt="Jewelry Dept." />
    </a>
  );
}

export default function ReviewsPage() {
  return (
    <main>
      <nav className="simpleNav" aria-label="Reviews navigation">
        <a href="/">← HOME</a>
        <Logo />
        <a href="/#pieces">SHOP ALL</a>
      </nav>

      <section className="marketplaceReviews" id="reviews">
        <div className="reviewsHeading">
          <div>
            <p className="eyebrow">CUSTOMER REVIEWS</p>
            <h1>Trusted locally.<br /><em>Rated by real buyers.</em></h1>
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

      <footer>
        <Logo />
        <p>Fire without compromise.<br />Solid gold. Certified stones. Set by hand.</p>
        <div className="footerLinks"><a href="/#pieces">SHOP</a><a href="/#custom">CUSTOM</a><a href="mailto:hello@jewelrydept.co">CONTACT</a></div>
        <div className="footerPolicies"><a href="/faq">FAQ</a><a href="/policies/shipping">SHIPPING</a><a href="/policies/returns">RETURNS</a><a href="/policies/privacy">PRIVACY</a><a href="/policies/terms">TERMS</a></div>
        <small>© 2026 JEWELRY DEPT. · ALL RIGHTS RESERVED</small>
      </footer>
    </main>
  );
}
