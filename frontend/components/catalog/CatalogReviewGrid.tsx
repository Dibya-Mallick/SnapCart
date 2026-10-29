"use client";

import { useState } from "react";
import { apiFetch, Product, money } from "../../lib/api";

export function CatalogReviewGrid({ initialProducts, storeSlug = "rinas-stall" }: { initialProducts: Product[]; storeSlug?: string }) {
  const [products, setProducts] = useState(initialProducts);
  const [saving, setSaving] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const update = (id: number, field: keyof Product, value: string | number) =>
    setProducts((current) => current.map((product) => product.id === id ? { ...product, [field]: value } : product));

  async function save(product: Product) {
    setSaving(product.id);
    setMessage("");
    try {
      await apiFetch(`/api/v1/dashboard/catalog/${product.id}?store_slug=${storeSlug}`, {
        method: "PATCH",
        body: JSON.stringify({ ...product, price_minor: product.price_minor || null, ai_needs_review: false, is_active: true }),
      });
      setMessage("Catalog changes saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save changes."); }
    finally { setSaving(null); }
  }

  async function remove(product: Product) {
    if (!window.confirm(`Remove ${product.name} from this catalog?`)) return;
    setSaving(product.id);
    setMessage("");
    try {
      await apiFetch(`/api/v1/dashboard/catalog/${product.id}?store_slug=${storeSlug}`, { method: "DELETE" });
      setProducts((current) => current.filter((item) => item.id !== product.id));
      setMessage(`${product.name} removed from the active catalog.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not remove the item."); }
    finally { setSaving(null); }
  }

  return <div className="data-card">
    <div className="table-toolbar"><div><strong>Catalog review</strong><span className="muted">Edit AI output before publishing</span></div><span className="review-count">{products.filter((p) => !p.price_minor).length} need review</span></div>
    {message && <div className="notice">{message}</div>}
    <div className="table-scroll"><table className="data-table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Dietary tags</th><th>Status</th><th /></tr></thead><tbody>
      {products.map((product) => <tr key={product.id} className={!product.price_minor ? "needs-review" : ""}>
        <td><input value={product.name} onChange={(e) => update(product.id, "name", e.target.value)} /><small>{product.description}</small></td>
        <td><input value={product.category} onChange={(e) => update(product.id, "category", e.target.value)} /></td>
        <td><input className="price-input" type="number" min="0" step="0.01" value={product.price_minor ? (product.price_minor / 100).toFixed(2) : ""} onChange={(e) => update(product.id, "price_minor", Math.round(Number(e.target.value) * 100))} /><small>{product.price_minor ? money(product.price_minor, product.currency) : "Price required"}</small></td>
        <td><div className="tag-list">{product.dietary_tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div></td>
        <td>{!product.price_minor ? <span className="status-pill warning">Needs review</span> : <span className="status-pill success">Ready</span>}</td>
        <td><div className="row-actions"><button className="small-button" onClick={() => save(product)} disabled={saving === product.id}>{saving === product.id ? "Saving…" : "Save"}</button><button className="delete-button" onClick={() => remove(product)} disabled={saving === product.id} aria-label={`Remove ${product.name}`}>Delete</button></div></td>
      </tr>)}
    </tbody></table></div>
  </div>;
}
