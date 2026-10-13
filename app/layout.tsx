import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://jewelrydept.co"),
  title: "Jewelry Dept. — Fire Without Compromise",
  description: "Moissanite, lab-grown and natural diamonds set in solid 10k–24k gold. Made to order and set by hand.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Jewelry Dept. — Fire Without Compromise",
    description: "Solid gold. Certified stones. Set by hand.",
    type: "website",
    url: "/",
    siteName: "Jewelry Dept.",
    images: [{
      url: "/og.jpg",
      width: 1734,
      height: 907,
      alt: "Jewelry Dept. — Fire Without Compromise",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Jewelry Dept. — Fire Without Compromise",
    description: "Solid gold. Certified stones. Set by hand.",
    images: ["/og.jpg"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
