"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Camera, Store } from "lucide-react";
import { API_URL } from "../../../../lib/api";

export default function NewCatalogPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<{ extraction_id: number; products: { name: string; needs_review: boolean }[] } | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) { setStatus("Choose a menu image first."); return; }
    setStatus("Extracting menu…");
    const form = new FormData(); form.append("file", file); form.append("store_slug", "rinas-stall");
    try { const response = await fetch(`${API_URL}/api/v1/catalog/extract`, { method: "POST", body: form }); const body = await response.json(); if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : body.detail?.message || "Extraction failed"); setResult(body); setStatus("Extraction complete. Review the draft before publishing."); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Extraction failed."); }
  }
  return <main className="app-shell"><header className="app-nav"><Link className="brand" href="/dashboard"><span className="brand-mark"><Store size={18} /></span>snap-a-store</Link><Link className="text-link" href="/dashboard"><ArrowLeft size={15} /> Back to dashboard</Link></header><div className="narrow-page"><p className="eyebrow">Step 1 · Create a catalog</p><h1>Snap your menu.</h1><p className="lead">Upload a clear photo of your menu and we’ll turn it into an editable product catalog.</p><form className="upload-card" onSubmit={submit}><label className="dropzone"><Camera size={28} /><strong>{file ? file.name : "Choose a menu image"}</strong><span>JPEG, PNG, or WebP · max 10 MB</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label><button className="primary-button wide-button" disabled={!file || status.startsWith("Extracting")}>{status.startsWith("Extracting") ? "Extracting…" : "Extract menu"}</button>{status && <div className="notice">{status}</div>}</form>{result && <div className="result-card"><div><strong>{result.products.length} products found</strong><span className="muted">{result.products.filter((p) => p.needs_review).length} need review</span></div><Link className="primary-button" href={`/dashboard/catalog/${result.extraction_id}/review`}>Review catalog <ArrowLeft size={16} className="rotate-180" /></Link></div>}</div></main>;
}
