"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Rocket, Store } from "lucide-react";
import { apiFetch, DashboardSummary, DEMO_STORE_SLUG, Product } from "../../../../../lib/api";
import { CatalogReviewGrid, ReviewState } from "../../../../../components/catalog/CatalogReviewGrid";

export default function CatalogReviewPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [storeStatus, setStoreStatus] = useState("");
  const [review, setReview] = useState<ReviewState>({ total: 0, needsReview: 0, unsaved: 0 });
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([apiFetch<Product[]>("/api/v1/dashboard/catalog"), apiFetch<DashboardSummary>("/api/v1/dashboard/summary")])
      .then(([catalog, summary]) => { setProducts(catalog); setStoreStatus(summary.store_status); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const lastTotal = useRef<number | null>(null);
  const onStateChange = useCallback((state: ReviewState) => {
    setReview(state);
    // Removing an item moves a live store back to draft on the server; refresh the status.
    if (lastTotal.current !== null && state.total !== lastTotal.current) {
      apiFetch<DashboardSummary>("/api/v1/dashboard/summary").then((summary) => setStoreStatus(summary.store_status)).catch(() => undefined);
    }
    lastTotal.current = state.total;
  }, []);

  async function publish() {
    setPublishing(true); setError("");
    try { await apiFetch(`/api/v1/stores/${DEMO_STORE_SLUG}/publish`, { method: "POST" }); setStoreStatus("published"); }
    catch (e) { setError(e instanceof Error ? e.message : "Publishing failed."); }
    finally { setPublishing(false); }
  }

  const ready = !loading && review.total > 0 && review.needsReview === 0 && review.unsaved === 0;
  const blocker = loading ? "Loading catalog…" : !review.total ? "Add at least one item" : review.unsaved ? `Approve ${review.unsaved} edited ${review.unsaved === 1 ? "row" : "rows"} first` : review.needsReview ? `Review ${review.needsReview} flagged ${review.needsReview === 1 ? "item" : "items"} first` : "Ready to go live";

  return <main className="app-shell"><header className="app-nav"><Link className="brand" href="/dashboard"><span className="brand-mark"><Store size={18} /></span>snap-a-store</Link><Link className="text-link" href="/dashboard"><ArrowLeft size={15} /> Dashboard</Link></header>
    <div className="page-heading"><div><p className="eyebrow">Step 2 · Human-in-the-loop review</p><h1>Review your catalog.</h1><p className="muted">AI drafts the catalog, you stay in control. Nothing reaches shoppers until every active item is approved.</p></div></div>
    <div className={`publish-bar${storeStatus === "published" ? " live" : ""}`}>
      <div className="publish-progress"><strong>{storeStatus === "published" ? <><Check size={16} /> Store is live</> : blocker}</strong><span className="muted">{review.total - review.needsReview} of {review.total} items approved · store is {storeStatus || "…"}</span><div className="progress-track"><i style={{ width: `${review.total ? ((review.total - review.needsReview) / review.total) * 100 : 0}%` }} /></div></div>
      {storeStatus === "published" && !review.unsaved ? <Link className="primary-button" href={`/store/${DEMO_STORE_SLUG}`}>Open live store <ArrowRight size={16} /></Link> : <button className="primary-button" onClick={publish} disabled={!ready || publishing}><Rocket size={16} /> {publishing ? "Publishing…" : "Publish store"}</button>}
    </div>
    {error && <div className="error-box">{error}</div>}
    <CatalogReviewGrid initialProducts={products} onStateChange={onStateChange} />
  </main>;
}
