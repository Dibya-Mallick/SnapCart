"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "./api";

/** Fetch a JSON endpoint and keep it fresh so new orders appear without a reload. */
export function useLiveData<T>(path: string, intervalMs = 5000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = () => apiFetch<T>(path)
      .then((next) => { if (!cancelled) { setData(next); setError(""); } })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Request failed"); });
    load();
    const timer = setInterval(() => { if (document.visibilityState === "visible") load(); }, intervalMs);
    return () => { cancelled = true; clearInterval(timer); };
  }, [path, intervalMs]);

  return { data, error };
}
