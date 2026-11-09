"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Bot, Lock, ShoppingBag } from "lucide-react";
import { BrandLogo } from "../../../components/BrandLogo";
import { apiFetch, PendingOrder } from "../../../lib/api";
import { OrderLines, PaymentReceipt } from "../../../components/checkout/OrderSummary";
import { PayPalCheckoutButton } from "../../../components/checkout/PayPalCheckoutButton";

type OrderDetail = PendingOrder & { paypal_order_id: string | null; paypal_capture_id: string | null };

/** Approval page for orders prepared elsewhere, e.g. by an external AI agent over MCP. */
export default function CheckoutLinkPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [storeName, setStoreName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<OrderDetail>(`/api/v1/orders/${orderId}`)
      .then((detail) => { setOrder(detail); return apiFetch<{ store_name: string }>(`/api/v1/stores/${detail.store_slug}`); })
      .then((store) => setStoreName(store.store_name))
      .catch((e) => setError(e instanceof Error ? e.message : "Order not found."));
  }, [orderId]);

  const fromAgent = order?.source === "ai_agent";
  let content: React.ReactNode;
  if (error) content = <div className="error-box">{error}</div>;
  else if (!order) content = <><div className="skeleton" style={{ height: 18, width: "60%" }} /><div className="skeleton" style={{ height: 14, marginTop: 14 }} /><div className="skeleton" style={{ height: 14, marginTop: 10 }} /></>;
  else if (order.status === "paid" && order.paypal_capture_id) content = <PaymentReceipt order={order} captureId={order.paypal_capture_id} />;
  else if (order.status !== "pending") content = <div className="error-box">This order is {order.status} and can no longer be paid.</div>;
  else content = <><div className="order-badge">{fromAgent ? <><Bot size={13} /> Prepared by an AI agent on your behalf</> : <><ShoppingBag size={13} /> Web order</>} · Order #{order.local_order_id}</div><OrderLines order={order} /><p className="trust-note"><Lock size={12} /> {fromAgent ? "The agent chose the items, but the store's server set every price. Nothing is charged until you approve in PayPal." : "Prices were set by the store's server. Nothing is charged until you approve in PayPal."}</p><PayPalCheckoutButton order={order} onPaid={(captureId) => setOrder({ ...order, status: "paid", paypal_capture_id: captureId })} /></>;

  return <main className="center-page checkout-link-page"><div className="checkout-link-card">
    <div className="checkout-link-header"><span className="brand-mark"><BrandLogo size={34} /></span><div><p className="eyebrow">Approve your order</p><h1>{storeName || "SnapCart checkout"}</h1></div></div>
    <div className="cart-card">{content}</div>
    {order && <Link className="text-link center-link" href={`/store/${order.store_slug}`}>Visit the store</Link>}
  </div></main>;
}
