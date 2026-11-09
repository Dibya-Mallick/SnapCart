"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Bot, Lock, Pencil, ShieldCheck, ShoppingBag } from "lucide-react";
import { BrandLogo } from "../../../components/BrandLogo";
import { apiFetch, CartItem, money, PendingOrder, Product } from "../../../lib/api";
import { PayPalCheckoutButton } from "../../../components/checkout/PayPalCheckoutButton";
import { OrderLines, PaymentReceipt } from "../../../components/checkout/OrderSummary";
import { AgentShoppingChat } from "../../../components/storefront/AgentShoppingChat";
import { ProductList, ProductListSkeleton } from "../../../components/storefront/ProductList";

type Receipt = { order: PendingOrder; captureId: string };

export default function StorePage() {
  const { slug } = useParams<{ slug: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [storeName, setStoreName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [order, setOrder] = useState<PendingOrder | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [checkoutError, setCheckoutError] = useState("");
  const [creatingOrder, setCreatingOrder] = useState(false);
  const cartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([apiFetch<{ store_name: string; currency: string }>(`/api/v1/stores/${slug}`), apiFetch<{ products: Product[]; currency: string }>(`/api/v1/stores/${slug}/catalog`)])
      .then(([store, catalog]) => { setStoreName(store.store_name); setCurrency(catalog.currency); setProducts(catalog.products); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  const total = useMemo(() => cart.reduce((sum, item) => sum + (item.price_minor || 0) * item.quantity, 0), [cart]);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const quantities = useMemo(() => Object.fromEntries(cart.map((item) => [item.id, item.quantity])), [cart]);

  // A pending order snapshots the cart, so any cart edit must discard it.
  function resetCheckout() { setOrder(null); setReceipt(null); setCheckoutError(""); }
  function add(product: Product) { setCart((current) => { const existing = current.find((item) => item.id === product.id); return existing ? current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item) : [...current, { ...product, quantity: 1 }]; }); resetCheckout(); }
  function change(id: number, amount: number) { setCart((current) => current.map((item) => item.id === id ? { ...item, quantity: Math.max(0, item.quantity + amount) } : item).filter((item) => item.quantity > 0)); resetCheckout(); }

  async function checkout() {
    setCreatingOrder(true); setCheckoutError("");
    try { setOrder(await apiFetch<PendingOrder>("/api/v1/orders", { method: "POST", body: JSON.stringify({ store_slug: slug, source: "web", items: cart.map((item) => ({ product_id: item.id, quantity: item.quantity })) }) })); }
    catch (e) { setCheckoutError(e instanceof Error ? e.message : "Could not create order."); }
    finally { setCreatingOrder(false); }
  }

  // Move a pending order's lines back into the editable cart.
  function editOrder() {
    if (!order) return;
    setCart(order.items.flatMap((item) => { const product = products.find((candidate) => candidate.id === item.product_id); return product ? [{ ...product, quantity: item.quantity }] : []; }));
    resetCheckout();
  }

  function handlePaid(captureId: string) { if (order) setReceipt({ order, captureId }); setOrder(null); setCart([]); }

  function handleAgentOrder(next: PendingOrder) {
    setCart([]); setReceipt(null); setCheckoutError(""); setOrder(next);
    cartRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  let cartContent: React.ReactNode;
  if (receipt) {
    cartContent = <PaymentReceipt order={receipt.order} captureId={receipt.captureId} onDone={resetCheckout} />;
  } else if (order) {
    cartContent = <><div className="order-badge">{order.source === "ai_agent" ? <><Bot size={13} /> Prepared by the AI assistant</> : <><ShoppingBag size={13} /> Your cart</>} · Order #{order.local_order_id}</div><OrderLines order={order} /><p className="trust-note"><Lock size={12} /> Prices were re-checked on the server. Nothing is charged until you approve in PayPal.</p><PayPalCheckoutButton key={order.local_order_id} order={order} onPaid={handlePaid} /><button className="ghost-button" onClick={editOrder}><Pencil size={13} /> Change order</button></>;
  } else if (cart.length) {
    cartContent = <>{cart.map((item) => <div className="cart-row" key={item.id}><div><strong>{item.name}</strong><small>{money(item.price_minor, currency)} each</small></div><div className="quantity-control"><button onClick={() => change(item.id, -1)} aria-label={`Remove one ${item.name}`}>−</button><span>{item.quantity}</span><button onClick={() => change(item.id, 1)} aria-label={`Add one ${item.name}`}>+</button></div></div>)}<div className="cart-total"><span>Total</span><strong>{money(total, currency)}</strong></div><button className="primary-button wide-button" onClick={checkout} disabled={creatingOrder}>{creatingOrder ? "Preparing order…" : "Checkout with PayPal"}</button></>;
  } else {
    cartContent = <div className="empty-cart"><ShoppingBag size={26} /><span>Your cart is empty</span><small>Add items from the menu, or ask the AI assistant to build a cart for you.</small></div>;
  }

  return <main className="store-page">
    <header className="store-nav"><Link className="brand" href="/"><span className="brand-mark"><BrandLogo size={34} /></span>SnapCart</Link><span className="live-badge"><i /> Live store</span><span className="store-nav-spacer" /><Link href="/dashboard">Merchant dashboard</Link></header>
    {error ? <div className="store-error">{error}</div> : <>
      <section className="store-hero"><div><span className="eyebrow">Order online · Pay with PayPal</span>{storeName ? <h1>{storeName}</h1> : <div className="skeleton skeleton-on-dark" style={{ width: 260, height: 44, marginBottom: 12 }} />}<p>Order straight from the menu, or tell the AI assistant what you want. Either way you approve the payment in PayPal.</p><div className="hero-pills"><span><ShieldCheck size={13} /> Server-verified prices</span><span><Bot size={13} /> Agent-ready</span></div></div><div className="store-hero-mark">{storeName ? storeName.slice(0, 1) : ""}</div></section>
      <div className="store-layout">
        <section className="menu-column"><div className="store-section-title"><div><p className="eyebrow">Today’s menu</p><h2>Pick your favorites</h2></div><span>{loading ? "Loading…" : `${products.length} items`}</span></div>{loading ? <ProductListSkeleton /> : <ProductList products={products} quantities={quantities} onAdd={add} />}</section>
        <aside className="shopping-column">
          <div className="cart-card" ref={cartRef}><div className="card-title"><span><ShoppingBag size={17} /> {receipt ? "Receipt" : order ? "Checkout" : "Your cart"}</span>{!order && !receipt && <span>{itemCount} {itemCount === 1 ? "item" : "items"}</span>}</div>{cartContent}{checkoutError && <div className="error-box">{checkoutError}</div>}</div>
          <div className="agent-card"><div className="agent-card-title"><span className="agent-avatar"><Bot size={16} /></span><div><strong>Shop with AI</strong><small>Limited to this store’s menu · you approve every payment</small></div><span className="online-dot" /></div><AgentShoppingChat storeSlug={slug} onOrder={handleAgentOrder} /></div>
        </aside>
      </div>
      {/* Phones show the menu first; this bar jumps down to the cart once there is something to pay for. */}
      {(itemCount > 0 || order) && !receipt && <button className="mobile-cart-bar" onClick={() => cartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}><ShoppingBag size={16} /> {order ? "Review & pay with PayPal" : `View cart · ${itemCount} ${itemCount === 1 ? "item" : "items"}`}<strong>{money(order ? order.total_minor : total, currency)}</strong></button>}
    </>}
  </main>;
}
