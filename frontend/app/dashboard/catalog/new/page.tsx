"use client";

import { DragEvent, FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, ArrowRight, Camera, Check, ImageUp, ScanText, Sparkles, Store } from "lucide-react";
import { API_URL, DEMO_STORE_SLUG, money } from "../../../../lib/api";

type ExtractionResult = { extraction_id: number; overall_warnings: string[]; products: { id: number; name: string; price_minor: number | null; currency: string; needs_review: boolean }[] };

const STAGES = [
  { icon: ImageUp, label: "Uploading photo" },
  { icon: ScanText, label: "Reading the menu" },
  { icon: Sparkles, label: "Structuring products & prices" },
];
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

export default function NewCatalogPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [dragging, setDragging] = useState(false);
  const [stage, setStage] = useState(-1);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const extracting = stage >= 0 && !result && !error;

  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Step through the stage labels while the single extraction request is in flight.
  useEffect(() => {
    if (!extracting || stage >= STAGES.length - 1) return;
    const timer = setTimeout(() => setStage((current) => current + 1), 700);
    return () => clearTimeout(timer);
  }, [extracting, stage]);

  function choose(next: File | undefined | null) {
    setResult(null); setError(""); setStage(-1);
    if (!next) return;
    if (!ACCEPTED.includes(next.type)) { setError("Please choose a JPEG, PNG, or WebP image."); return; }
    setFile(next);
  }

  function drop(event: DragEvent) { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files?.[0]); }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    setError(""); setResult(null); setStage(0);
    const form = new FormData(); form.append("file", file); form.append("store_slug", DEMO_STORE_SLUG);
    try {
      const response = await fetch(`${API_URL}/api/v1/catalog/extract`, { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : body.detail?.message || "Extraction failed");
      setStage(STAGES.length);
      setResult(body);
    } catch (e) { setError(e instanceof Error ? e.message : "Extraction failed."); setStage(-1); }
  }

  const needsReview = result ? result.products.filter((p) => p.needs_review).length : 0;

  return <main className="app-shell"><header className="app-nav"><Link className="brand" href="/dashboard"><span className="brand-mark"><Store size={18} /></span>snap-a-store</Link><Link className="text-link" href="/dashboard"><ArrowLeft size={15} /> Back to dashboard</Link></header>
    <div className="narrow-page"><p className="eyebrow">Step 1 · Create a catalog</p><h1>Snap your menu.</h1><p className="lead">Upload a photo of your menu board or printed menu. AI turns it into products and prices you can review before anything goes live.</p>
      <form className="upload-card" onSubmit={submit}>
        <label className={`dropzone${dragging ? " dragging" : ""}${preview ? " has-preview" : ""}`} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}>
          {preview ? <img src={preview} alt="Selected menu" className="dropzone-preview" /> : <Camera size={28} />}
          <strong>{file ? file.name : "Drop a menu photo here, or click to choose"}</strong>
          <span>{file ? `${file.size < 1024 * 1024 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${(file.size / 1024 / 1024).toFixed(1)} MB`} · click to change` : "JPEG, PNG, or WebP · max 10 MB"}</span>
          <input type="file" accept={ACCEPTED.join(",")} onChange={(e) => choose(e.target.files?.[0])} />
        </label>
        {stage >= 0 && <ol className="stage-list">{STAGES.map(({ icon: Icon, label }, index) => <li key={label} className={index < stage ? "done" : index === stage ? "active" : ""}>{index < stage ? <Check size={14} /> : <Icon size={14} />} {label}</li>)}</ol>}
        <button className="primary-button wide-button" disabled={!file || extracting}>{extracting ? "Extracting…" : result ? "Extract again" : "Extract menu"}</button>
        {error && <div className="error-box">{error}</div>}
      </form>
      {result && <div className="extraction-result">
        <div className="result-card"><div><strong>{result.products.length} products found</strong><span className="muted">{needsReview ? `${needsReview} ${needsReview === 1 ? "needs" : "need"} a quick review before publishing` : "Everything looks ready to publish"}</span></div><Link className="primary-button" href={`/dashboard/catalog/${result.extraction_id}/review`}>Review catalog <ArrowRight size={16} /></Link></div>
        <ul className="extracted-list">{result.products.map((product) => <li key={product.id} className={product.needs_review ? "flagged" : ""}><span>{product.needs_review ? <AlertTriangle size={14} /> : <Check size={14} />} {product.name}</span><strong>{product.price_minor == null ? "Price unclear" : money(product.price_minor, product.currency)}</strong></li>)}</ul>
        {result.overall_warnings.map((warning) => <div className="notice" key={warning}>{warning}</div>)}
      </div>}
    </div></main>;
}
