"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type { CellValueChangedEvent, ColDef, ICellRendererParams } from "ag-grid-community";
import { Pencil, ScanText } from "lucide-react";
import { apiFetch, DEMO_STORE_SLUG, Product, money } from "../../lib/api";
import { gridTheme } from "../../lib/agGrid";

export type ReviewState = { total: number; needsReview: number; unsaved: number };

const needsReview = (product: Product) => !product.price_minor || Boolean(product.ai_needs_review);

type GridState = { dirty: Set<number>; saving: number | null; save: (product: Product) => void; remove: (product: Product) => void };
// AG Grid may copy the context object, so it carries a ref whose value is always current.
type GridContext = { live: { current: GridState } };

function NameCell({ data }: ICellRendererParams<Product>) {
  if (!data) return null;
  return <div className="grid-name"><strong>{data.name}</strong>{data.source_text ? <small className="source-text"><ScanText size={11} /> AI read: “{data.source_text}”</small> : <small>{data.description}</small>}</div>;
}

function StatusCell({ data, context }: ICellRendererParams<Product, unknown, GridContext>) {
  if (!data) return null;
  if (context.live.current.dirty.has(data.id)) return <span className="status-pill info">Unsaved</span>;
  return needsReview(data) ? <span className="status-pill warning">Needs review</span> : <span className="status-pill success">Approved</span>;
}

function ActionsCell({ data, context }: ICellRendererParams<Product, unknown, GridContext>) {
  if (!data) return null;
  const { saving, dirty, save, remove } = context.live.current;
  const busy = saving === data.id;
  const pending = needsReview(data) || dirty.has(data.id);
  return <div className="row-actions"><button className="small-button" onClick={() => save(data)} disabled={busy}>{busy ? "Saving…" : pending ? "Approve" : "Save"}</button><button className="delete-button" onClick={() => remove(data)} disabled={busy} aria-label={`Remove ${data.name}`}>Delete</button></div>;
}

const COLUMNS: ColDef<Product>[] = [
  { field: "name", headerName: "Product", flex: 2, minWidth: 220, editable: true, cellRenderer: NameCell, autoHeight: true },
  { field: "category", headerName: "Category", flex: 1, minWidth: 120, editable: true },
  {
    colId: "price", headerName: "Price", width: 120, editable: true, cellEditor: "agNumberCellEditor", cellEditorParams: { min: 0, precision: 2 },
    valueGetter: (p) => p.data?.price_minor ? p.data.price_minor / 100 : null,
    valueSetter: (p) => { const value = Number(p.newValue); p.data.price_minor = Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null; return true; },
    valueFormatter: (p) => p.value == null ? "Price required" : money(Math.round(p.value * 100), p.data?.currency),
    cellClassRules: { "grid-missing": (p) => p.value == null },
  },
  {
    colId: "dietary_tags", headerName: "Dietary tags", flex: 1.3, minWidth: 170, editable: true,
    valueGetter: (p) => p.data?.dietary_tags.join(", ") ?? "",
    valueSetter: (p) => { p.data.dietary_tags = String(p.newValue || "").split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean); return true; },
    cellRenderer: (p: ICellRendererParams<Product>) => <div className="tag-list">{p.data?.dietary_tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>,
  },
  { colId: "status", headerName: "Status", width: 135, cellRenderer: StatusCell, sortable: false },
  { colId: "actions", headerName: "", width: 160, cellRenderer: ActionsCell, sortable: false },
];

export function CatalogReviewGrid({ initialProducts, storeSlug = DEMO_STORE_SLUG, onStateChange }: { initialProducts: Product[]; storeSlug?: string; onStateChange?: (state: ReviewState) => void }) {
  const [products, setProducts] = useState(initialProducts);
  const [saving, setSaving] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState<Set<number>>(new Set());
  const gridRef = useRef<AgGridReact<Product>>(null);

  // Parents often fetch products after mounting; adopt them once they arrive.
  useEffect(() => { setProducts(initialProducts); setDirty(new Set()); }, [initialProducts]);
  useEffect(() => { onStateChange?.({ total: products.length, needsReview: products.filter(needsReview).length, unsaved: dirty.size }); }, [products, dirty, onStateChange]);

  const markClean = (id: number) => setDirty((current) => { const next = new Set(current); next.delete(id); return next; });

  const save = useCallback(async (product: Product) => {
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
  }, [storeSlug]);

  const remove = useCallback(async (product: Product) => {
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
  }, [storeSlug]);

  // Cell renderers read the latest state through this ref; redraw them when it changes.
  const live = useRef<GridState>({ dirty, saving, save, remove });
  live.current = { dirty, saving, save, remove };
  const context = useMemo<GridContext>(() => ({ live }), []);
  useEffect(() => { gridRef.current?.api?.refreshCells({ columns: ["status", "actions"], force: true }); }, [dirty, saving, products]);

  function onCellValueChanged(event: CellValueChangedEvent<Product>) {
    if (!event.data) return;
    const updated = { ...event.data, dietary_tags: [...event.data.dietary_tags] };
    setProducts((current) => current.map((item) => item.id === updated.id ? updated : item));
    setDirty((current) => new Set(current).add(updated.id));
  }

  const flagged = products.filter(needsReview).length;
  return <div className="data-card">
    <div className="table-toolbar"><div><strong>Catalog review</strong><span className="muted"><Pencil size={12} /> Double-click a cell to edit · check what the AI read, then approve each row</span></div><span className={`review-count${flagged ? " warn" : ""}`}>{flagged ? `${flagged} ${flagged === 1 ? "needs" : "need"} review` : "All items approved"}</span></div>
    {message && <div className="notice">{message}</div>}
    <div className="grid-wrap"><AgGridReact<Product>
      ref={gridRef}
      theme={gridTheme}
      rowData={products}
      columnDefs={COLUMNS}
      context={context}
      defaultColDef={{ sortable: true, resizable: true, suppressMovable: true }}
      getRowId={(p) => String(p.data.id)}
      getRowClass={(p) => p.data && needsReview(p.data) ? "grid-needs-review" : undefined}
      onCellValueChanged={onCellValueChanged}
      singleClickEdit={false}
      stopEditingWhenCellsLoseFocus
      domLayout="autoHeight"
      rowHeight={64}
      headerHeight={44}
      overlayNoRowsTemplate="No active catalog items yet. Snap a menu to get started."
    /></div>
  </div>;
}
