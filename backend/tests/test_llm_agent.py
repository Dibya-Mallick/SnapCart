import json

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.services import llm_shopping_agent
from app.services.groq_client import LLMError


@pytest.fixture
def groq_enabled(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "groq")
    monkeypatch.setattr(settings, "groq_api_key", "test-key")


def _tool_call(name: str, arguments: dict, call_id: str = "call-1") -> dict:
    return {"id": call_id, "type": "function", "function": {"name": name, "arguments": json.dumps(arguments)}}


def _script(monkeypatch, replies: list) -> list[list[dict]]:
    """Make chat_completion return scripted replies and record the messages it saw."""
    seen: list[list[dict]] = []

    def fake_chat_completion(messages, **_kwargs):
        seen.append(list(messages))
        reply = replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply

    monkeypatch.setattr(llm_shopping_agent, "chat_completion", fake_chat_completion)
    return seen


def test_llm_agent_builds_cart_with_server_prices(monkeypatch, groq_enabled) -> None:
    with TestClient(app) as client:
        products = client.get("/api/v1/stores/rinas-stall/catalog").json()["products"]
        samosa = next(product for product in products if product["name"].startswith("Vegetable Samosa"))
        seen = _script(
            monkeypatch,
            [
                {"content": "", "tool_calls": [_tool_call("build_validated_cart", {"items": [{"product_id": samosa["id"], "quantity": 3}]})]},
                {"content": "Three samosas are in your cart. Please approve with PayPal.", "tool_calls": None},
            ],
        )
        response = client.post(
            "/api/v1/agent/chat",
            json={
                "store_slug": "rinas-stall",
                "message": "three samosas please",
                "history": [{"role": "user", "content": "hi"}, {"role": "assistant", "content": "Hello!"}],
            },
        )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "cart_prepared"
    assert body["planner"].startswith("groq:")
    assert body["order"]["total_minor"] == samosa["price_minor"] * 3
    assert [call["name"] for call in body["tool_calls"]] == ["list_store_catalog", "build_validated_cart"]
    # Earlier turns and the live catalog are passed to the model.
    first_request = seen[0]
    assert {"role": "assistant", "content": "Hello!"} in first_request
    assert any(message["role"] == "tool" and samosa["name"] in message["content"] for message in first_request)


def test_llm_agent_reports_invalid_product_back_to_the_model(monkeypatch, groq_enabled) -> None:
    seen = _script(
        monkeypatch,
        [
            {"content": "", "tool_calls": [_tool_call("build_validated_cart", {"items": [{"product_id": 999999, "quantity": 1}]})]},
            {"content": "Sorry, that item isn't on the menu. What would you like instead?", "tool_calls": None},
        ],
    )
    with TestClient(app) as client:
        response = client.post("/api/v1/agent/chat", json={"store_slug": "rinas-stall", "message": "a pizza"})
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "needs_clarification"
    assert body["order"] is None
    assert "error" in body["tool_calls"][-1]["result"]
    assert "unavailable" in seen[1][-1]["content"]


def test_llm_failure_falls_back_to_rule_based_planner(monkeypatch, groq_enabled) -> None:
    _script(monkeypatch, [LLMError("provider down")])
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/agent/chat",
            json={"store_slug": "rinas-stall", "message": "Two samosas and a mango lassi"},
        )
    assert response.status_code == 200
    body = response.json()
    assert body["planner"] == "rules"
    assert body["status"] == "cart_prepared"
