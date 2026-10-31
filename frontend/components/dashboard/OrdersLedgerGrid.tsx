"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { gridTheme } from "../../lib/agGrid";
import { Bot, ShoppingBag } from "lucide-react";
import { LedgerOrder, money, parseApiDate, timeAgo } from "../../lib/api";
import { useLiveData } from "../../lib/useLiveData";

const FILTERS = [
  { key: "all", label: "All", match: () => true },
  { key: "paid", label: "Paid", match: (order: LedgerOrder) => order.status === "paid" },
  { key: "pending", label: "Pending", match: (order: LedgerOrder) => order.status === "pending" },
  { key: "agent", label: "AI agent", match: (order: LedgerOrder) => order.source === "ai_agent" },
  { key: "web", label: "Web cart", match: (order: LedgerOrder) => order.source === "web" },
] as const;

export const statusTone = (status: string) => status === "paid" ? "success" : status === "failed" ? "danger" : "warning";

export function SourcePill({ source }: { source: string }) {
  return <span className={`source-pill ${source === "ai_agent" ? "agent" : ""}`}>{source === "ai_agent" ? <><Bot size={11} /> AI agent</> : <><ShoppingBag size={11} /> Web cart</>}</span>;
}

/** Returns ids that appeared since the first load, so new activity can be highlighted. */
export function useFreshIds(orders: LedgerOrder[] | null) {
  const seen = useRef<Set<number> | null>(null);
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  useEffect(() => {
    if (!orders) return;
    if (!seen.current) { seen.current = new Set(orders.map((order) => order.id)); return; }
    const arrived = orders.filter((order) => !seen.current!.has(order.id)).map((order) => order.id);
    if (!arrived.length) return;
    arrived.forEach((id) => seen.current!.add(id));
    setFresh(new Set(arrived));
    const timer = setTimeout(() => setFresh(new Set()), 6000);
    return () => clearTimeout(timer);
  }, [orders]);
  return fresh;
}

type LedgerRow = LedgerOrder & { pinnedLabel?: string };

const COLUMNS: ColDef<LedgerRow>[] = [
  { field: "id", headerName: "Order", width: 110, sort: "desc", cellRenderer: (p: ICellRendererParams<LedgerRow>) => p.data?.pinnedLabel ? <strong>{p.data.pinnedLabel}</strong> : <strong>#{p.value}</strong> },
  { field: "source", headerName: "Channel", width: 140, cellRenderer: (p: ICellRendererParams<LedgerRow>) => p.data?.pinnedLabel ? null : <SourcePill source={p.value} />, valueFormatter: (p) => p.value === "ai_agent" ? "AI agent" : "Web cart" },
  { field: "status", headerName: "Status", width: 120, cellRenderer: (p: ICellRendererParams<LedgerRow>) => p.data?.pinnedLabel ? null : <span className={`status-pill ${statusTone(p.value)}`}>{p.value}</span> },
  { field: "total_minor", headerName: "Total", width: 120, type: "rightAligned", valueFormatter: (p) => money(p.value, p.data?.currency || "USD"), cellClass: "grid-money" },
  { field: "paypal_capture_id", headerName: "PayPal capture", flex: 1, minWidth: 170, cellClass: "mono", valueFormatter: (p) => p.data?.pinnedLabel ? "" : p.value || "—" },
  { field: "created_at", headerName: "Created", width: 140, valueFormatter: (p) => p.data?.pinnedLabel || !p.value ? "" : timeAgo(p.value), tooltipValueGetter: (p) => p.value ? parseApiDate(p.value).toLocaleString() : "", comparator: (a: string, b: string) => parseApiDate(a).getTime() - parseApiDate(b).getTime() },
];

export function OrdersLedgerGrid() {
  const { data: orders, error } = useLiveData<LedgerOrder[]>("/api/v1/dashboard/orders");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [search, setSearch] = useState("");
  const fresh = useFreshIds(orders);
  const list = orders || [];
  const visible = useMemo(() => list.filter(FILTERS.find((item) => item.key === filter)!.match), [list, filter]);
  const paidVolume = list.filter((order) => order.status === "paid").reduce((sum, order) => sum + order.total_minor, 0);
  const currency = list[0]?.currency || "USD";
  const pinned = useMemo<LedgerRow[]>(() => [{ id: 0, source: "", status: "", currency, total_minor: visible.filter((order) => order.status === "paid").reduce((sum, order) => sum + order.total_minor, 0), paypal_capture_id: null, created_at: "", pinnedLabel: "Captured" }], [visible, currency]);

  return <div className="data-card"><div className="table-toolbar"><div><strong>Orders ledger</strong><span className="muted"><span className="online-dot" /> Live · {list.length} orders · {money(paidVolume, currency)} captured via PayPal</span></div>
    <div className="ledger-controls"><input className="grid-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search orders, captures…" aria-label="Search orders" /><div className="filter-tabs" role="tablist">{FILTERS.map((item) => <button key={item.key} role="tab" aria-selected={filter === item.key} className={filter === item.key ? "active" : ""} onClick={() => setFilter(item.key)}>{item.label} <span>{list.filter(item.match).length}</span></button>)}</div></div></div>
    {error && <div className="error-box">{error}</div>}
    <div className="grid-wrap"><AgGridReact<LedgerRow>
      theme={gridTheme}
      rowData={orders ? visible : undefined}
      columnDefs={COLUMNS}
      defaultColDef={{ sortable: true, resizable: true, suppressMovable: true }}
      getRowId={(p) => p.data.pinnedLabel ? "pinned" : String(p.data.id)}
      getRowClass={(p) => p.data && fresh.has(p.data.id) ? "fresh-row" : undefined}
      pinnedBottomRowData={list.length ? pinned : undefined}
      quickFilterText={search}
      domLayout="autoHeight"
      rowHeight={52}
      headerHeight={44}
      tooltipShowDelay={300}
      overlayNoRowsTemplate={list.length ? "No orders match this filter." : "No orders yet. Place one from the storefront to see it appear here live."}
    /></div>
  </div>;
}
