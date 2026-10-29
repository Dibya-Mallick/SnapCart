"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bot, Check, ShoppingBag, Store } from "lucide-react";
import { useParams } from "next/navigation";
import { apiFetch, CartItem, money, PendingOrder, Product } from "../../../lib/api";
import { PayPalCheckoutButton } from "../../../components/checkout/PayPalCheckoutButton";
import { AgentShoppingChat } from "../../../components/storefront/AgentShoppingChat";
import { ProductList } from "../../../components/storefront/ProductList";

export default function StorePage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [products, setProducts] = useState<Product[]>([]);
  const [storeName, setStoreName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [order, setOrder] = useState<PendingOrder | null>(null);
  const [paid, setPaid] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { Promise.all([apiFetch<{ store_name: string; currency: string }>(`/api/v1/stores/${slug}`), apiFetch<{ products: Product[]; currency: string }>(`/api/v1/stores/${slug}/catalog`)]).then(([store, catalog]) => { setStoreName(store.store_name); setCurrency(catalog.currency); setProducts(catalog.products); }).catch((e) => setError(e.message)); }, [slug]);
  const total = useMemo(() => cart.reduce((sum, item) => sum + (item.price_minor || 0) * item.quantity, 0), [cart]);
  function add(product: Product) { setCart((current) => { const existing = current.find((item) => item.id === product.id); return existing ? current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item) : [...current, { ...product, quantity: 1 }]; }); setOrder(null); }
  function change(id: number, amount: number) { setCart((current) => current.map((item) => item.id === id ? { ...item, quantity: Math.max(0, item.quantity + amount) } : item).filter((item) => item.quantity > 0)); }
  async function checkout() { try { const created = await apiFetch<PendingOrder>("/api/v1/orders", { method: "POST", body: JSON.stringify({ store_slug: slug, source: "web", items: cart.map((item) => ({ product_id: item.id, quantity: item.quantity })) }) }); setOrder(created); } catch (e) { setError(e instanceof Error ? e.message : "Could not create order."); } }
  return <main className="store-page"><header className="store-nav"><Link className="brand" href="/"><span className="brand-mark"><Store size={18} /></span>snap-a-store</Link><span className="live-badge"><i /> Live store</span><span className="store-nav-spacer" /><Link href="/dashboard">Merchant dashboard</Link></header>{error ? <div className="store-error">{error}</div> : <><section className="store-hero"><div><span className="eyebrow">Fresh street food · Dhaka</span><h1>{storeName || "Your favorite local food"}</h1><p>Order directly from the menu, or ask our shopping assistant to find something for you.</p></div><div className="store-hero-mark">{storeName ? storeName.slice(0, 1) : "R"}</div></section><div className="store-layout"><section className="menu-column"><div className="store-section-title"><div><p className="eyebrow">Today’s menu</p><h2>Pick your favorites</h2></div><span>{products.length} items</span></div><ProductList products={products} onAdd={add} /></section><aside className="shopping-column"><div className="cart-card"><div className="card-title"><span><ShoppingBag size={17} /> Your cart</span><span>{cart.reduce((sum, item) => sum + item.quantity, 0)} items</span></div>{cart.length ? <>{cart.map((item) => <div className="cart-row" key={item.id}><div><strong>{item.name}</strong><small>{money(item.price_minor, currency)} each</small></div><div className="quantity-control"><button onClick={() => change(item.id, -1)}>−</button><span>{item.quantity}</span><button onClick={() => change(item.id, 1)}>+</button></div></div>)}<div className="cart-total"><span>Total</span><strong>{money(total, currency)}</strong></div><button className="primary-button wide-button" onClick={checkout}>Continue to PayPal</button>{order && <PayPalCheckoutButton order={order} onPaid={(captureId) => setPaid(captureId)} />}{paid && <div className="success-box"><Check size={17} /> Payment verified · {paid}</div>}</> : <div className="empty-cart"><ShoppingBag size={26} /><span>Your cart is empty</span><small>Add something delicious to get started.</small></div>}</div><div className="agent-card"><div className="agent-card-title"><span className="agent-avatar"><Bot size={16} /></span><div><strong>Shop with AI</strong><small>Ask in your own words</small></div></div><AgentShoppingChat storeSlug={slug} onOrder={(nextOrder) => { setOrder(nextOrder); setCart([]); }} /></div></aside></div></>}</main>;
}
