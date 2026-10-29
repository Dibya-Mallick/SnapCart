"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bot, CircleDollarSign, Package, Plus, Store } from "lucide-react";
import { apiFetch, money, Product } from "../../lib/api";
import { CatalogReviewGrid } from "../../components/catalog/CatalogReviewGrid";

type Summary = { store_name: string; store_slug: string; store_status: string; catalog_items: number; items_needing_review: number; orders_today: number; paid_orders: number; pending_orders: number; total_payment_volume_minor: number; currency: string };

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { Promise.all([apiFetch<Summary>("/api/v1/dashboard/summary"), apiFetch<Product[]>("/api/v1/dashboard/catalog")]).then(([s, p]) => { setSummary(s); setProducts(p); }).catch((e) => setError(e.message)); }, []);
  return <main className="app-shell"><header className="app-nav"><Link className="brand" href="/"><span className="brand-mark"><Store size={18} /></span>snap-a-store</Link><nav><Link href="/store/rinas-stall">View store</Link><Link className="nav-button" href="/dashboard/catalog/new"><Plus size={15} /> New menu</Link></nav></header><div className="page-heading"><div><p className="eyebrow">Merchant workspace</p><h1>Good morning, Rina.</h1><p className="muted">Review your catalog, publish updates, and keep an eye on orders.</p></div><Link className="secondary-button" href="/dashboard/orders">Open orders <ArrowRight size={16} /></Link></div>{error && <div className="error-box">{error}</div>}{summary && <><div className="metric-grid"><div className="metric-card"><span className="metric-icon blue"><CircleDollarSign size={19} /></span><small>Payment volume</small><strong>{money(summary.total_payment_volume_minor, summary.currency)}</strong><span className="metric-note">{summary.paid_orders} paid orders</span></div><div className="metric-card"><span className="metric-icon green"><Package size={19} /></span><small>Catalog items</small><strong>{summary.catalog_items}</strong><span className="metric-note">{summary.items_needing_review} need review</span></div><div className="metric-card"><span className="metric-icon yellow"><Bot size={19} /></span><small>Orders today</small><strong>{summary.orders_today}</strong><span className="metric-note">{summary.pending_orders} pending</span></div><div className="metric-card"><span className="metric-status"><i /> {summary.store_status}</span><small>Store status</small><strong>{summary.store_name}</strong><span className="metric-note">/{summary.store_slug}</span></div></div><div className="section-row"><div><h2>Catalog workspace</h2><p className="muted">AI-extracted items waiting for your approval.</p></div><Link className="text-link" href="/dashboard/catalog/rinas-stall/review">Open full review <ArrowRight size={15} /></Link></div><CatalogReviewGrid initialProducts={products} /></>}</main>;
}
