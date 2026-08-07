import { notFound } from "next/navigation";
import type { Metadata } from "next";

const policies = {
  shipping: {
    title: "Shipping & Delivery",
    updated: "August 7, 2026",
    sections: [
      ["Processing", "In-stock orders are normally prepared within 1–3 business days. Custom and made-to-order pieces have a separate timeline confirmed with your approved quote."],
      ["Rates", "Standard shipping is $9.95 for merchandise totals of $100 or less. Merchandise totals over $100 receive free standard shipping."],
      ["Delivery", "Estimated standard delivery is 3–7 business days after carrier acceptance. Carrier delays, weather, customs, and address corrections may affect timing."],
      ["Tracking", "Tracking is provided by email when a label is created. Customers are responsible for providing a complete, accurate delivery address."],
      ["International", "Checkout currently supports addresses in the United States and Mexico. Duties, taxes, brokerage, or import charges assessed by a destination country are the customer’s responsibility."],
    ],
  },
  returns: {
    title: "Returns & Refunds",
    updated: "August 7, 2026",
    sections: [
      ["30-day returns", "Eligible in-stock items may be requested for return within 30 days of delivery. Items must be unworn, unaltered, undamaged, and returned with their original packaging and included documentation."],
      ["Non-returnable items", "Custom, personalized, engraved, resized, modified, final-sale, and made-to-order pieces are not returnable unless they arrive damaged or materially different from the approved order."],
      ["Starting a return", "Email hello@jewelrydept.co before shipping anything back. Returns sent without approval may be refused. Return shipping is the customer’s responsibility unless Jewelry Dept. confirms an error or defect."],
      ["Refund timing", "Approved refunds are issued to the original payment method after inspection. Banks and card providers may require additional time to post the credit."],
    ],
  },
  privacy: {
    title: "Privacy Policy",
    updated: "August 7, 2026",
    sections: [
      ["Information we collect", "We collect information needed to operate the store, including contact details, shipping and billing details, order information, customer messages, and basic site-usage data."],
      ["How we use it", "Information is used to process orders, provide service, prevent fraud, improve the website, communicate order updates, and meet legal obligations."],
      ["Payments and service providers", "Payment information is handled by Stripe. Shipping services may receive delivery details. Hosting, database, analytics, and email providers process only the information needed to provide their services."],
      ["Your choices", "You may ask to access, correct, or delete eligible personal information by emailing hello@jewelrydept.co. Transaction records may be retained when required for tax, fraud-prevention, or legal purposes."],
    ],
  },
  terms: {
    title: "Terms of Service",
    updated: "August 7, 2026",
    sections: [
      ["Products and pricing", "Product availability, descriptions, images, weights, dimensions, and prices may change. Natural variation, screen settings, and handcrafted production can cause reasonable differences in appearance."],
      ["Orders", "An order is accepted after payment is authorized and Jewelry Dept. confirms fulfillment. We may cancel and refund an order affected by pricing errors, suspected fraud, unavailable inventory, or an undeliverable address."],
      ["Custom work", "Custom estimates are not final offers. Production begins only after design details, materials, final price, payment terms, and timing are approved. Custom deposits and payments may be non-refundable once work or material sourcing begins."],
      ["Site use", "You may use this website only for lawful shopping and communication. Automated abuse, interference, fraud, unauthorized access, and copying of site content are prohibited."],
      ["Contact", "Questions about these terms may be sent to hello@jewelrydept.co."],
    ],
  },
} as const;

export function generateStaticParams() {
  return Object.keys(policies).map(slug => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const policy = policies[slug as keyof typeof policies];
  return { title: policy ? `${policy.title} — Jewelry Dept.` : "Policy — Jewelry Dept." };
}

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const policy = policies[slug as keyof typeof policies];
  if (!policy) notFound();
  return (
    <main className="policyPage">
      <nav className="simpleNav"><a href="/">JEWELRY DEPT.</a><a href="/#pieces">SHOP</a></nav>
      <article>
        <p className="eyebrow">CUSTOMER CARE</p>
        <h1>{policy.title}</h1>
        <p className="policyUpdated">Last updated {policy.updated}</p>
        {policy.sections.map(([heading, body]) => <section key={heading}><h2>{heading}</h2><p>{body}</p></section>)}
        <div className="policyContact"><b>Need help?</b><a href="mailto:hello@jewelrydept.co">hello@jewelrydept.co</a></div>
      </article>
    </main>
  );
}
