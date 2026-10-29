import Link from "next/link";
import { ArrowLeft, Store } from "lucide-react";

export default function CheckoutCancelPage() { return <main className="center-page"><div className="receipt-card"><span className="cancel-icon">!</span><p className="eyebrow">Checkout cancelled</p><h1>Your order is still waiting.</h1><p>No payment was captured. Return to the store whenever you’re ready to try again.</p><Link className="primary-button wide-button" href="/store/rinas-stall"><ArrowLeft size={16} /> Return to store</Link></div></main>; }
