"use client";

import { useState } from "react";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { ShieldCheck } from "lucide-react";
import { apiFetch, PendingOrder } from "../../lib/api";

export function PayPalCheckoutButton({ order, onPaid }: { order: PendingOrder; onPaid: (captureId: string) => void }) {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const [error, setError] = useState("");
  if (!clientId) return <div className="payment-placeholder"><strong><ShieldCheck size={14} /> PayPal Sandbox is not configured</strong><span>Add NEXT_PUBLIC_PAYPAL_CLIENT_ID (and the server-side PayPal keys) to enable buyer approval.</span></div>;
  return <div className="paypal-buttons">{error && <div className="error-box">{error}</div>}<PayPalScriptProvider options={{ clientId, currency: order.currency, intent: "capture" }}><PayPalButtons style={{ layout: "vertical", shape: "rect", label: "paypal" }} createOrder={async () => { setError(""); const created = await apiFetch<{ paypal_order_id: string }>("/api/v1/payments/paypal/create-order", { method: "POST", body: JSON.stringify({ local_order_id: order.local_order_id }) }); return created.paypal_order_id; }} onApprove={async (data) => { try { const captured = await apiFetch<{ paypal_capture_id: string }>("/api/v1/payments/paypal/capture-order", { method: "POST", body: JSON.stringify({ local_order_id: order.local_order_id, paypal_order_id: data.orderID }) }); onPaid(captured.paypal_capture_id); } catch (e) { setError(e instanceof Error ? e.message : "Payment could not be verified."); } }} onCancel={() => setError("Payment was cancelled. Your order is still pending; you can try again.")} onError={(e) => setError(e instanceof Error ? e.message : "PayPal checkout failed. Please try again.")} /></PayPalScriptProvider></div>;
}
