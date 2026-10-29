"use client";

import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { apiFetch, PendingOrder, money } from "../../lib/api";

export function PayPalCheckoutButton({ order, onPaid }: { order: PendingOrder; onPaid: (captureId: string) => void }) {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  if (!clientId) return <div className="payment-placeholder"><strong>PayPal Sandbox is not configured</strong><span>Add NEXT_PUBLIC_PAYPAL_CLIENT_ID to enable approval.</span></div>;
  return <div className="paypal-wrap"><div className="checkout-total">Total <strong>{money(order.total_minor, order.currency)}</strong></div><PayPalScriptProvider options={{ clientId, currency: order.currency, intent: "capture" }}><PayPalButtons style={{ layout: "vertical", shape: "rect", label: "paypal" }} createOrder={async () => { const created = await apiFetch<{ paypal_order_id: string }>("/api/v1/payments/paypal/create-order", { method: "POST", body: JSON.stringify({ local_order_id: order.local_order_id }) }); return created.paypal_order_id; }} onApprove={async (data) => { const captured = await apiFetch<{ paypal_capture_id: string }>("/api/v1/payments/paypal/capture-order", { method: "POST", body: JSON.stringify({ local_order_id: order.local_order_id, paypal_order_id: data.orderID }) }); onPaid(captured.paypal_capture_id); }} onError={() => undefined} /></PayPalScriptProvider></div>;
}
