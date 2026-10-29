"use client";

import { useEffect, useState } from "react";
import { apiFetch, money } from "../../lib/api";

type Order = { id: number; source: string; status: string; currency: string; total_minor: number; paypal_capture_id: string | null; created_at: string };

export function OrdersLedgerGrid() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { apiFetch<Order[]>("/api/v1/dashboard/orders").then(setOrders).catch((e) => setError(e.message)); }, []);
  return <div className="data-card"><div className="table-toolbar"><div><strong>Orders ledger</strong><span className="muted">Latest activity from web and AI shoppers</span></div><span className="review-count">{orders.length} orders</span></div>
    {error && <div className="error-box">{error}</div>}
    <div className="table-scroll"><table className="data-table"><thead><tr><th>Order</th><th>Source</th><th>Status</th><th>Total</th><th>PayPal capture</th><th>Created</th></tr></thead><tbody>
      {orders.map((order) => <tr key={order.id}><td><strong>#{order.id}</strong></td><td><span className="source-pill">{order.source === "ai_agent" ? "AI Agent" : "Web cart"}</span></td><td><span className={`status-pill ${order.status === "paid" ? "success" : "warning"}`}>{order.status}</span></td><td>{money(order.total_minor, order.currency)}</td><td className="mono">{order.paypal_capture_id || "—"}</td><td>{new Date(order.created_at).toLocaleString()}</td></tr>)}
      {!orders.length && !error && <tr><td colSpan={6} className="empty-state">No orders yet.</td></tr>}
    </tbody></table></div>
  </div>;
}
