"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Store } from "lucide-react";
import { apiFetch, Product } from "../../../../../lib/api";
import { CatalogReviewGrid } from "../../../../../components/catalog/CatalogReviewGrid";

export default function CatalogReviewPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [message, setMessage] = useState("");
  useEffect(() => { apiFetch<Product[]>("/api/v1/dashboard/catalog").then(setProducts).catch((e) => setMessage(e.message)); }, []);
  async function publish() { try { await apiFetch("/api/v1/stores/rinas-stall/publish", { method: "POST" }); setMessage("Store published successfully."); } catch (error) { setMessage(error instanceof Error ? error.message : "Publishing failed."); } }
  return <main className="app-shell"><header className="app-nav"><Link className="brand" href="/dashboard"><span className="brand-mark"><Store size={18} /></span>snap-a-store</Link><Link className="text-link" href="/dashboard"><ArrowLeft size={15} /> Dashboard</Link></header><div className="page-heading"><div><p className="eyebrow">Human-in-the-loop review</p><h1>Review your catalog.</h1><p className="muted">Fix anything ambiguous, then publish the store when every active item is ready.</p></div><button className="primary-button" onClick={publish}>Publish store</button></div>{message && <div className="notice">{message}</div>}<CatalogReviewGrid initialProducts={products} /></main>;
}
