import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "../../../components/BrandLogo";
import { OrdersLedgerGrid } from "../../../components/dashboard/OrdersLedgerGrid";

export default function OrdersPage() { return <main className="app-shell"><header className="app-nav"><Link className="brand" href="/dashboard"><span className="brand-mark"><BrandLogo size={34} /></span>SnapCart</Link><Link className="text-link" href="/dashboard"><ArrowLeft size={15} /> Dashboard</Link></header><div className="page-heading"><div><p className="eyebrow">Step 4 · Merchant ledger</p><h1>Orders.</h1><p className="muted">Every order, whether a person or an AI agent placed it, with its PayPal capture reference.</p></div></div><OrdersLedgerGrid /></main>; }
