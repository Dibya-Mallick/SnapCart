export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
// The demo runs against a single seeded merchant store.
export const DEMO_STORE_SLUG = "rinas-stall";

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { ...options, headers: { "Content-Type": "application/json", ...(options?.headers || {}) } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = body.detail;
    const message = typeof detail === "object" && detail !== null ? [detail.message, ...(detail.errors || [])].filter(Boolean).join(" — ") : detail;
    throw new Error(message || `Request failed (${response.status})`);
  }
  return response.json();
}

export type Product = { id: number; name: string; description: string; price_minor: number | null; currency: string; category: string; dietary_tags: string[]; source_text?: string; ai_needs_review?: boolean };
export type CartItem = Product & { quantity: number };
export type OrderLine = { product_id: number; product_name: string; unit_price_minor: number; quantity: number; line_total_minor: number };
export type PendingOrder = { local_order_id: number; store_slug: string; source: string; status: string; currency: string; subtotal_minor: number; total_minor: number; items: OrderLine[] };
export type AgentToolCall = { name: string; arguments: Record<string, unknown>; result: Record<string, unknown> };
export type AgentReply = { status: "cart_prepared" | "needs_clarification"; message: string; tool_calls: AgentToolCall[]; order: PendingOrder | null; planner: string };
export type DashboardSummary = { store_name: string; store_slug: string; store_status: string; catalog_items: number; items_needing_review: number; orders_today: number; paid_orders: number; pending_orders: number; total_payment_volume_minor: number; currency: string };
export type LedgerOrder = { id: number; source: string; status: string; currency: string; total_minor: number; paypal_capture_id: string | null; created_at: string };

export const money = (minor: number | null, currency = "USD") => minor == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);

// The API stores naive UTC timestamps; mark them as UTC so the browser converts to local time.
export const parseApiDate = (value: string) => new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);

export function timeAgo(value: string) {
  const seconds = Math.max(0, Math.round((Date.now() - parseApiDate(value).getTime()) / 1000));
  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;
  return parseApiDate(value).toLocaleDateString();
}

export const productEmoji = (product: Pick<Product, "category" | "name">) => {
  const text = `${product.category} ${product.name}`.toLowerCase();
  if (/lassi|mango/.test(text)) return "🥭";
  if (/drink|tea|chai|coffee|juice|soda/.test(text)) return "🥤";
  if (/roll|wrap|main|chicken|rice|curry/.test(text)) return "🌯";
  if (/sweet|dessert|cake/.test(text)) return "🍮";
  if (/samosa/.test(text)) return "🥟";
  if (/chaat|snack|bite/.test(text)) return "🥙";
  return "🍽️";
};
