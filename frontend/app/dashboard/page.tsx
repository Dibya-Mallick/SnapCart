"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bot, CircleDollarSign, ExternalLink, Package, Plus, ShoppingBag, Store } from "lucide-react";
import { apiFetch, DashboardSummary, DEMO_STORE_SLUG, LedgerOrder, money, Product, timeAgo } from "../../lib/api";
import { useLiveData } from "../../lib/useLiveData";
import { CatalogReviewGrid } from "../../components/catalog/CatalogReviewGrid";
import { SourcePill, statusTone, useFreshIds } from "../../components/dashboard/OrdersLedgerGrid";

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export default function DashboardPage() {
  const { data: summary, error } = useLiveData<DashboardSummary>("/api/v1/dashboard/summary");
  const { data: orders } = useLiveData<LedgerOrder[]>("/api/v1/dashboard/orders");
  const [products, setProducts] = useState<Product[]>([]);
  const [hello, setHello] = useState("Welcome back");
  const fresh = useFreshIds(orders);
  // The catalog is fetched once: polling it would overwrite in-progress edits in the grid.
  useEffect(() => { apiFetch<Product[]>("/api/v1/dashboard/catalog").then(setProducts).catch(() => undefined); setHello(greeting()); }, []);

  const list = orders || [];
  const agentOrders = list.filter((order) => order.source === "ai_agent").length;
  const agentShare = list.length ? Math.round((agentOrders / list.length) * 100) : 0;
  const live = summary?.store_status === "published";

  return <main className="app-shell"><header className="app-nav"><Link className="brand" href="/"><span className="brand-mark"><Store size={18} /></span>snap-a-store</Link><nav><Link href={`/store/${DEMO_STORE_SLUG}`}>View store <ExternalLink size={12} /></Link><Link className="nav-button" href="/dashboard/catalog/new"><Plus size={15} /> New menu</Link></nav></header>
    <div className="page-heading"><div><p className="eyebrow">Merchant workspace</p><h1>{hello}{summary ? `, ${summary.store_name}` : ""}.</h1><p className="muted">Your catalog, your storefront, and every PayPal payment, from people and AI agents alike.</p></div><Link className="secondary-button" href="/dashboard/orders">Open orders ledger <ArrowRight size={16} /></Link></div>
    {error && <div className="error-box">{error}</div>}
    <div className="metric-grid">
      <div className="metric-card"><span className="metric-icon blue"><CircleDollarSign size={19} /></span><small>Captured with PayPal</small>{summary ? <strong>{money(summary.total_payment_volume_minor, summary.currency)}</strong> : <div className="skeleton metric-skeleton" />}<span className="metric-note">{summary ? `${summary.paid_orders} paid orders` : " "}</span></div>
      <div className="metric-card"><span className="metric-icon yellow"><Bot size={19} /></span><small>AI agent orders</small>{orders ? <strong>{agentOrders}</strong> : <div className="skeleton metric-skeleton" />}<span className="metric-note">{agentShare}% of all orders</span><div className="channel-bar" aria-label={`${agentShare}% of orders from AI agents`}><i style={{ width: `${agentShare}%` }} /></div></div>
      <div className="metric-card"><span className="metric-icon green"><Package size={19} /></span><small>Catalog items</small>{summary ? <strong>{summary.catalog_items}</strong> : <div className="skeleton metric-skeleton" />}<span className="metric-note">{summary ? (summary.items_needing_review ? `${summary.items_needing_review} need review` : "All approved") : " "}</span></div>
      <div className="metric-card"><span className={`metric-status${live ? "" : " draft"}`}><i /> {summary?.store_status || "…"}</span><span className="metric-icon blue"><ShoppingBag size={19} /></span><small>Orders today</small>{summary ? <strong>{summary.orders_today}</strong> : <div className="skeleton metric-skeleton" />}<span className="metric-note">{summary ? `${summary.pending_orders} awaiting payment` : " "}</span></div>
    </div>
    <div className="dashboard-columns">
      <section><div className="section-row"><div><h2>Catalog workspace</h2><p className="muted">Approve AI-extracted items before they go live.</p></div><Link className="text-link" href="/dashboard/catalog/latest/review">Review & publish <ArrowRight size={15} /></Link></div><CatalogReviewGrid initialProducts={products} /></section>
      <section><div className="section-row"><div><h2>Live activity</h2><p className="muted"><span className="online-dot" /> Updates every few seconds</p></div><Link className="text-link" href="/dashboard/orders">All orders <ArrowRight size={15} /></Link></div>
        <div className="data-card activity-feed">{!orders && [0, 1, 2].map((key) => <div className="activity-row" key={key}><div className="skeleton" style={{ height: 14, width: "100%" }} /></div>)}{list.slice(0, 6).map((order) => <div className={`activity-row${fresh.has(order.id) ? " fresh-row" : ""}`} key={order.id}><div><strong>Order #{order.id}</strong><small>{timeAgo(order.created_at)}</small></div><SourcePill source={order.source} /><span className={`status-pill ${statusTone(order.status)}`}>{order.status}</span><strong className="activity-amount">{money(order.total_minor, order.currency)}</strong></div>)}{orders && !list.length && <div className="empty-state">No orders yet. <Link className="text-link" href={`/store/${DEMO_STORE_SLUG}`}>Open the store</Link> and place one.</div>}</div>
      </section>
    </div>
  </main>;
}
