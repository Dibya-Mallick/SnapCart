"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, ShoppingBag } from "lucide-react";
import { LedgerOrder, money, parseApiDate, timeAgo } from "../../lib/api";
import { useLiveData } from "../../lib/useLiveData";

const FILTERS = [
  { key: "all", label: "All", match: () => true },
  { key: "paid", label: "Paid", match: (order: LedgerOrder) => order.status === "paid" },
  { key: "pending", label: "Pending", match: (order: LedgerOrder) => order.status === "pending" },
  { key: "agent", label: "AI agent", match: (order: LedgerOrder) => order.source === "ai_agent" },
  { key: "web", label: "Web cart", match: (order: LedgerOrder) => order.source === "web" },
] as const;

export const statusTone = (status: string) => status === "paid" ? "success" : status === "failed" ? "danger" : "warning";

export function SourcePill({ source }: { source: string }) {
  return <span className={`source-pill ${source === "ai_agent" ? "agent" : ""}`}>{source === "ai_agent" ? <><Bot size={11} /> AI agent</> : <><ShoppingBag size={11} /> Web cart</>}</span>;
}

/** Returns ids that appeared since the first load, so new activity can be highlighted. */
export function useFreshIds(orders: LedgerOrder[] | null) {
  const seen = useRef<Set<number> | null>(null);
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  useEffect(() => {
    if (!orders) return;
    if (!seen.current) { seen.current = new Set(orders.map((order) => order.id)); return; }
    const arrived = orders.filter((order) => !seen.current!.has(order.id)).map((order) => order.id);
    if (!arrived.length) return;
    arrived.forEach((id) => seen.current!.add(id));
    setFresh(new Set(arrived));
    const timer = setTimeout(() => setFresh(new Set()), 6000);
    return () => clearTimeout(timer);
  }, [orders]);
  return fresh;
}

export function OrdersLedgerGrid() {
  const { data: orders, error } = useLiveData<LedgerOrder[]>("/api/v1/dashboard/orders");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const fresh = useFreshIds(orders);
  const list = orders || [];
  const visible = list.filter(FILTERS.find((item) => item.key === filter)!.match);
  const paidVolume = list.filter((order) => order.status === "paid").reduce((sum, order) => sum + order.total_minor, 0);

  return <div className="data-card"><div className="table-toolbar"><div><strong>Orders ledger</strong><span className="muted"><span className="online-dot" /> Live · {list.length} orders · {money(paidVolume, list[0]?.currency || "USD")} captured via PayPal</span></div>
    <div className="filter-tabs" role="tablist">{FILTERS.map((item) => <button key={item.key} role="tab" aria-selected={filter === item.key} className={filter === item.key ? "active" : ""} onClick={() => setFilter(item.key)}>{item.label} <span>{list.filter(item.match).length}</span></button>)}</div></div>
    {error && <div className="error-box">{error}</div>}
    <div className="table-scroll"><table className="data-table"><thead><tr><th>Order</th><th>Channel</th><th>Status</th><th>Total</th><th>PayPal capture</th><th>Created</th></tr></thead><tbody>
      {!orders && !error && [0, 1, 2].map((key) => <tr key={key}><td colSpan={6}><div className="skeleton" style={{ height: 14 }} /></td></tr>)}
      {visible.map((order) => <tr key={order.id} className={fresh.has(order.id) ? "fresh-row" : ""}><td><strong>#{order.id}</strong></td><td><SourcePill source={order.source} /></td><td><span className={`status-pill ${statusTone(order.status)}`}>{order.status}</span></td><td>{money(order.total_minor, order.currency)}</td><td className="mono">{order.paypal_capture_id || "—"}</td><td title={parseApiDate(order.created_at).toLocaleString()}>{timeAgo(order.created_at)}</td></tr>)}
      {orders && !visible.length && <tr><td colSpan={6} className="empty-state">{list.length ? "No orders match this filter." : "No orders yet. Place one from the storefront to see it appear here live."}</td></tr>}
    </tbody></table></div>
  </div>;
}
