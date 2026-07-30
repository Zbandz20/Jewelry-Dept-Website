import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://jewelrydept.co"),
  title: "Jewelry Dept. — Fire Without Compromise",
  description: "Moissanite, lab-grown and natural diamonds set in solid 10k–24k gold. Made to order and set by hand.",
  openGraph: {
    title: "Jewelry Dept. — Fire Without Compromise",
    description: "Solid gold. Certified stones. Set by hand.",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
