import type { Metadata } from "next";
import { DemoFlow } from "../components/DemoFlow";
import "./globals.css";

export const metadata: Metadata = { title: "Snap-a-Store", description: "From menu photo to a PayPal-ready storefront that people and AI agents can shop" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><DemoFlow />{children}</body></html>;
}
