"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Camera, ClipboardCheck, ReceiptText, ShoppingBag } from "lucide-react";
import { DEMO_STORE_SLUG } from "../lib/api";

const STEPS = [
  { label: "Snap menu", href: "/dashboard/catalog/new", icon: Camera, match: (path: string) => path.startsWith("/dashboard/catalog/new") },
  { label: "Review & publish", href: "/dashboard/catalog/latest/review", icon: ClipboardCheck, match: (path: string) => path.endsWith("/review") },
  { label: "Shop & pay with PayPal", href: `/store/${DEMO_STORE_SLUG}`, icon: ShoppingBag, match: (path: string) => path.startsWith("/store") || path.startsWith("/checkout") },
  { label: "Track orders", href: "/dashboard/orders", icon: ReceiptText, match: (path: string) => path === "/dashboard" || path.startsWith("/dashboard/orders") },
];

/** A slim guided-tour bar that ties the merchant and shopper screens into one story. */
export function DemoFlow() {
  const pathname = usePathname() || "/";
  if (pathname === "/") return null;
  const activeIndex = STEPS.findIndex((step) => step.match(pathname));
  return <nav className="demo-flow" aria-label="Demo flow">
    <span className="demo-flow-label">Demo flow</span>
    <ol>{STEPS.map(({ label, href, icon: Icon }, index) => <li key={label} className={index === activeIndex ? "active" : index < activeIndex ? "done" : ""}>
      <Link href={href} aria-current={index === activeIndex ? "step" : undefined}><span className="demo-flow-index">{index + 1}</span><Icon size={14} /><span className="demo-flow-text">{label}</span></Link>
    </li>)}</ol>
  </nav>;
}
