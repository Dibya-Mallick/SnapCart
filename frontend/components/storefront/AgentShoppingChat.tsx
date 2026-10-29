"use client";

import { FormEvent, useState } from "react";
import { apiFetch, PendingOrder } from "../../lib/api";

export function AgentShoppingChat({ storeSlug, onOrder }: { storeSlug: string; onOrder: (order: PendingOrder) => void }) {
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("Tell me what you’re looking for and I’ll prepare a cart.");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); if (!message.trim()) return; setLoading(true); try { const result = await apiFetch<{ message: string; order: PendingOrder }>("/api/v1/agent/chat", { method: "POST", body: JSON.stringify({ store_slug: storeSlug, message }) }); setReply(result.message); if (result.order) onOrder(result.order); } catch (error) { setReply(error instanceof Error ? error.message : "The shopping assistant is unavailable."); } finally { setLoading(false); } }
  return <div className="agent-panel"><div className="agent-header"><span className="agent-avatar">✦</span><div><strong>AI shopping assistant</strong><small>Bounded to this store’s catalog</small></div><span className="online-dot" /></div><div className="chat-body"><div className="chat-message assistant">{reply}</div><div className="suggestions"><button onClick={() => setMessage("Order two vegetable samosas and a mango lassi")}>Two samosas + a lassi</button><button onClick={() => setMessage("Find me a dairy-free snack")}>Dairy-free snack</button></div></div><form className="chat-form" onSubmit={submit}><input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ask for something from the menu…" /><button className="primary-button" disabled={loading}>{loading ? "…" : "Send"}</button></form></div>;
}
