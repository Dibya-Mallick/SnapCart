"""Minimal client for Groq's OpenAI-compatible chat completions API."""

from __future__ import annotations

from typing import Any

import httpx

from app.core.config import settings


class LLMError(RuntimeError):
    """The LLM provider was unreachable or returned an unusable response."""


def chat_completion(
    messages: list[dict[str, Any]],
    *,
    tools: list[dict[str, Any]] | None = None,
    json_mode: bool = False,
    temperature: float = 0.3,
    max_tokens: int = 2048,
    timeout: float = 60.0,
) -> dict[str, Any]:
    """Return the first choice's message (content and any tool_calls)."""
    if not settings.groq_enabled:
        raise LLMError("GROQ_API_KEY is not configured")
    payload: dict[str, Any] = {
        "model": settings.groq_model,
        "messages": messages,
        "temperature": temperature,
        "max_completion_tokens": max_tokens,
        # Keep the model's private reasoning out of the visible reply.
        "reasoning_format": "hidden",
    }
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = "auto"
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    try:
        response = httpx.post(
            f"{settings.groq_base_url}/chat/completions",
            headers={"Authorization": f"Bearer {settings.groq_api_key}"},
            json=payload,
            timeout=timeout,
        )
    except httpx.HTTPError as exc:
        raise LLMError("Groq request failed") from exc
    if response.is_error:
        raise LLMError(f"Groq rejected the request ({response.status_code}): {response.text[:300]}")
    try:
        return response.json()["choices"][0]["message"]
    except (ValueError, KeyError, IndexError) as exc:
        raise LLMError("Groq returned an unexpected response") from exc
