import Link from "next/link";
import { Check, Store } from "lucide-react";
import { DEMO_STORE_SLUG } from "../../../lib/api";

export default function CheckoutSuccessPage() { return <main className="center-page"><div className="receipt-card"><span className="success-icon"><Check size={26} /></span><p className="eyebrow">Payment verified</p><h1>Thanks for your order.</h1><p>Your PayPal payment was captured and your order is now confirmed.</p><Link className="primary-button wide-button" href={`/store/${DEMO_STORE_SLUG}`}><Store size={16} /> Return to store</Link></div></main>; }
