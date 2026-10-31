"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Check, Search, Send, ShoppingCart, Sparkles } from "lucide-react";
import { AgentReply, AgentToolCall, apiFetch, money, PendingOrder } from "../../lib/api";

type ChatMessage = { role: "user" | "assistant"; text: string; toolCalls?: AgentToolCall[] };

const SUGGESTIONS = ["Two samosas and a mango lassi", "Find me a dairy-free snack", "A main and a drink under $6"];

function describeTool(call: AgentToolCall) {
  if (call.name === "list_store_catalog") {
    const products = Array.isArray(call.result.products) ? call.result.products : [];
    return { icon: Search, text: `Searched the live menu · ${products.length} items` };
  }
  if (call.name === "build_validated_cart") {
    const total = typeof call.result.total_minor === "number" ? call.result.total_minor : null;
    const currency = typeof call.result.currency === "string" ? call.result.currency : "USD";
    return { icon: ShoppingCart, text: `Built a server-priced cart · ${money(total, currency)}` };
  }
  return { icon: Check, text: call.name };
}

export function AgentShoppingChat({ storeSlug, onOrder }: { storeSlug: string; onOrder: (order: PendingOrder) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", text: "Hi! Tell me what you're craving and I'll build a cart from this store's menu. You approve the payment with PayPal." }]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" }); }, [messages, loading]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || loading) return;
    setDraft("");
    setMessages((current) => [...current, { role: "user", text: message }]);
    setLoading(true);
    try {
      const result = await apiFetch<AgentReply>("/api/v1/agent/chat", { method: "POST", body: JSON.stringify({ store_slug: storeSlug, message }) });
      setMessages((current) => [...current, { role: "assistant", text: result.message, toolCalls: result.tool_calls }]);
      if (result.order) onOrder(result.order);
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", text: error instanceof Error ? error.message : "The shopping assistant is unavailable." }]);
    } finally { setLoading(false); }
  }

  function submit(event: FormEvent) { event.preventDefault(); send(draft); }

  return <div className="agent-panel">
    <div className="chat-body" ref={bodyRef} aria-live="polite">
      {messages.map((message, index) => <div key={index} className={`chat-row ${message.role}`}>
        {message.toolCalls && message.toolCalls.length > 0 && <ol className="tool-steps">{message.toolCalls.map((call, step) => { const { icon: Icon, text } = describeTool(call); return <li key={step} style={{ animationDelay: `${step * 180}ms` }}><Icon size={12} /> {text}<Check size={12} className="tool-check" /></li>; })}</ol>}
        <div className="chat-message">{message.text}</div>
      </div>)}
      {loading && <div className="chat-row assistant"><div className="chat-message typing" aria-label="Assistant is thinking"><i /><i /><i /></div></div>}
    </div>
    <div className="suggestions">{SUGGESTIONS.map((suggestion) => <button type="button" key={suggestion} onClick={() => send(suggestion)} disabled={loading}><Sparkles size={11} /> {suggestion}</button>)}</div>
    <form className="chat-form" onSubmit={submit}><input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask for something from the menu…" aria-label="Message the shopping assistant" /><button className="primary-button" disabled={loading || !draft.trim()} aria-label="Send"><Send size={14} /></button></form>
  </div>;
}
