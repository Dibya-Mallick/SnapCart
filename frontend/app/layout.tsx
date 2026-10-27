import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Snap-a-Store", description: "AI-assisted merchant storefronts" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

