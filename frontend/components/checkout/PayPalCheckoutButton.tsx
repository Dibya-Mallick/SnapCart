"use client";

import { useState } from "react";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { apiFetch, PendingOrder, money } from "../../lib/api";

export function PayPalCheckoutButton({ order, onPaid }: { order: PendingOrder; onPaid: (captureId: string) => void }) {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const [error, setError] = useState("");
  const summary = <>{order.items.map((item) => <div className="cart-row" key={item.product_id}><div><strong>{item.quantity}× {item.product_name}</strong><small>{money(item.unit_price_minor, order.currency)} each</small></div><span>{money(item.line_total_minor, order.currency)}</span></div>)}<div className="checkout-total">Order #{order.local_order_id} total <strong>{money(order.total_minor, order.currency)}</strong></div></>;
  if (!clientId) return <div className="paypal-wrap">{summary}<div className="payment-placeholder"><strong>PayPal Sandbox is not configured</strong><span>Add NEXT_PUBLIC_PAYPAL_CLIENT_ID to enable approval.</span></div></div>;
  return <div className="paypal-wrap">{summary}{error && <div className="error-box">{error}</div>}<PayPalScriptProvider options={{ clientId, currency: order.currency, intent: "capture" }}><PayPalButtons style={{ layout: "vertical", shape: "rect", label: "paypal" }} createOrder={async () => { setError(""); const created = await apiFetch<{ paypal_order_id: string }>("/api/v1/payments/paypal/create-order", { method: "POST", body: JSON.stringify({ local_order_id: order.local_order_id }) }); return created.paypal_order_id; }} onApprove={async (data) => { try { const captured = await apiFetch<{ paypal_capture_id: string }>("/api/v1/payments/paypal/capture-order", { method: "POST", body: JSON.stringify({ local_order_id: order.local_order_id, paypal_order_id: data.orderID }) }); onPaid(captured.paypal_capture_id); } catch (e) { setError(e instanceof Error ? e.message : "Payment could not be verified."); } }} onCancel={() => setError("Payment was cancelled. Your order is still pending; you can try again.")} onError={(e) => setError(e instanceof Error ? e.message : "PayPal checkout failed. Please try again.")} /></PayPalScriptProvider></div>;
}
