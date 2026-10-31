"use client";

import { useEffect, useState } from "react";
import { ScanText } from "lucide-react";
import { apiFetch, DEMO_STORE_SLUG, Product, money } from "../../lib/api";

export type ReviewState = { total: number; needsReview: number; unsaved: number };

const needsReview = (product: Product) => !product.price_minor || Boolean(product.ai_needs_review);

export function CatalogReviewGrid({ initialProducts, storeSlug = DEMO_STORE_SLUG, onStateChange }: { initialProducts: Product[]; storeSlug?: string; onStateChange?: (state: ReviewState) => void }) {
  const [products, setProducts] = useState(initialProducts);
  const [saving, setSaving] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState<Set<number>>(new Set());
  // Raw text typed into price inputs, so partial values like "1." are not reformatted mid-edit.
  const [priceDrafts, setPriceDrafts] = useState<Record<number, string>>({});

  // Parents often fetch products after mounting; adopt them once they arrive.
  useEffect(() => { setProducts(initialProducts); setDirty(new Set()); }, [initialProducts]);
  useEffect(() => { onStateChange?.({ total: products.length, needsReview: products.filter(needsReview).length, unsaved: dirty.size }); }, [products, dirty, onStateChange]);

  const update = (id: number, field: keyof Product, value: string | number) => {
    setProducts((current) => current.map((product) => product.id === id ? { ...product, [field]: value } : product));
    setDirty((current) => new Set(current).add(id));
  };

  const markClean = (id: number) => setDirty((current) => { const next = new Set(current); next.delete(id); return next; });

  async function save(product: Product) {
    setSaving(product.id);
    setMessage("");
    try {
      const saved = await apiFetch<Product>(`/api/v1/dashboard/catalog/${product.id}?store_slug=${storeSlug}`, {
        method: "PATCH",
        body: JSON.stringify({ ...product, price_minor: product.price_minor || null, ai_needs_review: false, is_active: true }),
      });
      setProducts((current) => current.map((item) => item.id === saved.id ? saved : item));
      markClean(saved.id);
      setMessage(saved.ai_needs_review ? `${saved.name} saved, but it still needs a price.` : `${saved.name} approved.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save changes."); }
    finally { setSaving(null); }
  }

  async function remove(product: Product) {
    if (!window.confirm(`Remove ${product.name} from this catalog?`)) return;
    setSaving(product.id);
    setMessage("");
    try {
      await apiFetch<Product>(`/api/v1/dashboard/catalog/${product.id}?store_slug=${storeSlug}`, { method: "DELETE" });
      setProducts((current) => current.filter((item) => item.id !== product.id));
      markClean(product.id);
      setMessage(`${product.name} removed from the active catalog.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not remove the item."); }
    finally { setSaving(null); }
  }

  const flagged = products.filter(needsReview).length;
  return <div className="data-card">
    <div className="table-toolbar"><div><strong>Catalog review</strong><span className="muted">Check what the AI read, fix anything unclear, then approve each row</span></div><span className={`review-count${flagged ? " warn" : ""}`}>{flagged ? `${flagged} need review` : "All items approved"}</span></div>
    {message && <div className="notice">{message}</div>}
    <div className="table-scroll"><table className="data-table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Dietary tags</th><th>Status</th><th /></tr></thead><tbody>
      {products.map((product) => <tr key={product.id} className={needsReview(product) ? "needs-review" : ""}>
        <td><input value={product.name} onChange={(e) => update(product.id, "name", e.target.value)} aria-label="Product name" />{product.source_text ? <small className="source-text"><ScanText size={11} /> AI read: “{product.source_text}”</small> : <small>{product.description}</small>}</td>
        <td><input value={product.category} onChange={(e) => update(product.id, "category", e.target.value)} aria-label="Category" /></td>
        <td><input className="price-input" type="number" min="0" step="0.01" placeholder="0.00" aria-label="Price" value={priceDrafts[product.id] ?? (product.price_minor ? (product.price_minor / 100).toFixed(2) : "")} onChange={(e) => { const raw = e.target.value; setPriceDrafts((d) => ({ ...d, [product.id]: raw })); update(product.id, "price_minor", Math.round(Number(raw) * 100)); }} onBlur={() => setPriceDrafts(({ [product.id]: _, ...rest }) => rest)} /><small>{product.price_minor ? money(product.price_minor, product.currency) : "Price required"}</small></td>
        <td><div className="tag-list">{product.dietary_tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div></td>
        <td>{dirty.has(product.id) ? <span className="status-pill info">Unsaved</span> : needsReview(product) ? <span className="status-pill warning">Needs review</span> : <span className="status-pill success">Approved</span>}</td>
        <td><div className="row-actions"><button className="small-button" onClick={() => save(product)} disabled={saving === product.id}>{saving === product.id ? "Saving…" : needsReview(product) || dirty.has(product.id) ? "Approve" : "Save"}</button><button className="delete-button" onClick={() => remove(product)} disabled={saving === product.id} aria-label={`Remove ${product.name}`}>Delete</button></div></td>
      </tr>)}
      {!products.length && <tr><td colSpan={6} className="empty-state">No active catalog items yet. Snap a menu to get started.</td></tr>}
    </tbody></table></div>
  </div>;
}
