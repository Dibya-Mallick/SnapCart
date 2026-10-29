export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

export type Product = { id: number; name: string; description: string; price_minor: number | null; currency: string; category: string; dietary_tags: string[]; };
export type CartItem = Product & { quantity: number };
export type PendingOrder = { local_order_id: number; store_slug: string; source: string; status: string; currency: string; subtotal_minor: number; total_minor: number; items: { product_id: number; product_name: string; unit_price_minor: number; quantity: number; line_total_minor: number }[]; };
export const money = (minor: number | null, currency = "USD") => minor == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
