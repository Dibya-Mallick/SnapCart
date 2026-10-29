import Link from "next/link";
import { ArrowLeft, Store } from "lucide-react";
import { OrdersLedgerGrid } from "../../../components/dashboard/OrdersLedgerGrid";

export default function OrdersPage() { return <main className="app-shell"><header className="app-nav"><Link className="brand" href="/dashboard"><span className="brand-mark"><Store size={18} /></span>snap-a-store</Link><Link className="text-link" href="/dashboard"><ArrowLeft size={15} /> Dashboard</Link></header><div className="page-heading"><div><p className="eyebrow">Merchant workspace</p><h1>Orders.</h1><p className="muted">Every order, whether it came from a person or an AI agent.</p></div></div><OrdersLedgerGrid /></main>; }
