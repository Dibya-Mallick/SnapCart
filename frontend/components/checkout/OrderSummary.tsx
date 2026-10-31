import { Check, ReceiptText } from "lucide-react";
import Link from "next/link";
import { money, PendingOrder } from "../../lib/api";

export function OrderLines({ order }: { order: PendingOrder }) {
  return <>{order.items.map((item) => <div className="cart-row" key={item.product_id}><div><strong>{item.quantity}× {item.product_name}</strong><small>{money(item.unit_price_minor, order.currency)} each</small></div><span className="line-total">{money(item.line_total_minor, order.currency)}</span></div>)}<div className="cart-total"><span>Total</span><strong>{money(order.total_minor, order.currency)}</strong></div></>;
}

export function PaymentReceipt({ order, captureId, onDone, doneLabel = "Start a new order" }: { order: PendingOrder; captureId: string; onDone?: () => void; doneLabel?: string }) {
  return <div className="receipt"><span className="success-icon"><Check size={22} /></span><strong className="receipt-title">Payment captured</strong><p className="muted">PayPal approved the payment and the server verified the captured amount.</p><div className="receipt-lines"><OrderLines order={order} /></div><dl className="receipt-meta"><div><dt>Order</dt><dd>#{order.local_order_id}</dd></div><div><dt>PayPal capture</dt><dd className="mono">{captureId}</dd></div></dl>{onDone && <button className="primary-button wide-button" onClick={onDone}>{doneLabel}</button>}<Link className="text-link center-link" href="/dashboard/orders"><ReceiptText size={14} /> See it in the merchant ledger</Link></div>;
}
