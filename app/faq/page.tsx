import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Frequently Asked Questions — Jewelry Dept.",
  description: "Answers about Jewelry Dept. materials, moissanite, sizing, shipping, returns, custom jewelry, and care.",
};

const questions = [
  {
    question: "What are your current in-stock pieces made from?",
    answer: "Unless a product listing says otherwise, current in-stock pieces are crafted in solid 925 sterling silver and set with moissanite stones. Each piece is inspected by Jewelry Dept. before shipping.",
  },
  {
    question: "Is moissanite a diamond?",
    answer: "No. Moissanite is a separate lab-created gemstone known for exceptional brilliance, colorful fire, and durability. Jewelry Dept. also offers lab-grown and natural diamonds for approved custom projects.",
  },
  {
    question: "How do I choose the right chain or bracelet size?",
    answer: "Product names and descriptions list available widths and lengths when known. Measure a piece you already own or use a flexible measuring tape. Contact us before ordering if you are unsure about fit.",
  },
  {
    question: "How much is shipping?",
    answer: "Standard U.S. shipping is $9.95. Merchandise orders over $100 receive free standard shipping. The final shipping charge and delivery estimate are shown during secure checkout.",
  },
  {
    question: "When will my order ship?",
    answer: "In-stock pieces are prepared after payment and any required security review. Standard delivery is generally estimated at 3–7 business days after shipment. Tracking is emailed when the shipping label is created.",
  },
  {
    question: "What is your return policy?",
    answer: "Eligible in-stock items may be returned within 30 days under the posted return policy. Custom, altered, engraved, worn, damaged, and final-sale pieces may not be eligible. Review the full policy before ordering.",
  },
  {
    question: "How do custom jewelry requests work?",
    answer: "Submit your design, preferred gold purity, estimated weight, stone choice, and contact information. Management reviews every request and must approve the final quote before any payment can be accepted.",
  },
  {
    question: "How should I care for my jewelry?",
    answer: "Store pieces separately in a dry pouch. Avoid chlorine, harsh chemicals, and abrasive cleaners. Wipe gently with a soft jewelry cloth after wear and contact us before using ultrasonic or steam cleaning.",
  },
  {
    question: "How can I contact Jewelry Dept.?",
    answer: "Email hello@jewelrydept.co with your order number or product name. We will respond as soon as possible during normal business hours.",
  },
];

function Logo() {
  return <a className="wordmark" href="/" aria-label="Jewelry Dept. home"><img src="/images/jewelry-dept-shopify-logo-transparent.png" alt="Jewelry Dept." /></a>;
}

export default function FaqPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map(item => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <main className="faqPage">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <nav className="simpleNav" aria-label="FAQ navigation">
        <a href="/">← HOME</a><Logo /><a href="/#pieces">SHOP ALL</a>
      </nav>
      <header className="faqHero">
        <p className="eyebrow">CLIENT SUPPORT</p>
        <h1>Questions,<br /><em>answered clearly.</em></h1>
        <p>Materials, sizing, shipping, returns, custom work, and care—everything to know before choosing your piece.</p>
      </header>
      <section className="faqList" aria-label="Frequently asked questions">
        {questions.map((item, index) => (
          <details key={item.question} open={index === 0}>
            <summary><span>{String(index + 1).padStart(2, "0")}</span>{item.question}<b aria-hidden="true">+</b></summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </section>
      <section className="faqContact">
        <div><p className="eyebrow">STILL NEED HELP?</p><h2>Talk to Jewelry Dept.</h2><p>Include the product name or your order number so we can help faster.</p></div>
        <a className="primary" href="mailto:hello@jewelrydept.co">EMAIL US →</a>
      </section>
      <footer>
        <Logo />
        <p>Fire without compromise.<br />Solid silver and gold. Certified stones. Set by hand.</p>
        <div className="footerLinks"><a href="/#pieces">SHOP</a><a href="/#custom">CUSTOM</a><a href="/reviews">REVIEWS</a></div>
        <div className="footerPolicies"><a href="/faq">FAQ</a><a href="/policies/shipping">SHIPPING</a><a href="/policies/returns">RETURNS</a><a href="/policies/privacy">PRIVACY</a><a href="/policies/terms">TERMS</a></div>
        <small>© 2026 JEWELRY DEPT. · ALL RIGHTS RESERVED</small>
      </footer>
    </main>
  );
}
