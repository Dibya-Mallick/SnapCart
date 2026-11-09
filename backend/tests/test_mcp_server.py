import json

from fastapi.testclient import TestClient

from app.main import app

HEADERS = {"Accept": "application/json, text/event-stream", "Content-Type": "application/json"}


def _rpc(client: TestClient, method: str, params: dict | None = None, request_id: int = 1) -> dict:
    response = client.post(
        "/mcp",
        headers=HEADERS,
        json={"jsonrpc": "2.0", "id": request_id, "method": method, "params": params or {}},
    )
    assert response.status_code == 200, response.text
    return response.json()


def _call_tool(client: TestClient, name: str, arguments: dict) -> dict:
    result = _rpc(client, "tools/call", {"name": name, "arguments": arguments})["result"]
    assert not result.get("isError"), result
    return json.loads(result["content"][0]["text"])


def test_mcp_lists_the_bounded_shopping_tools() -> None:
    with TestClient(app) as client:
        initialized = _rpc(
            client,
            "initialize",
            {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "pytest", "version": "1"}},
        )
        assert initialized["result"]["serverInfo"]["name"] == "snap-a-store"
        tools = {tool["name"] for tool in _rpc(client, "tools/list")["result"]["tools"]}
    assert tools == {"list_stores", "get_store_catalog", "build_validated_cart", "check_order_payment_status"}


def test_external_agent_can_build_a_cart_and_gets_a_checkout_link() -> None:
    with TestClient(app) as client:
        stores = _call_tool(client, "list_stores", {})["stores"]
        assert any(store["store_slug"] == "rinas-stall" for store in stores)
        products = _call_tool(client, "get_store_catalog", {"store_slug": "rinas-stall"})["products"]
        product = products[0]
        order = _call_tool(
            client,
            "build_validated_cart",
            {"store_slug": "rinas-stall", "items": [{"product_id": product["id"], "quantity": 2}]},
        )
        status = _call_tool(
            client,
            "check_order_payment_status",
            {"store_slug": "rinas-stall", "local_order_id": order["local_order_id"]},
        )
    assert order["source"] == "ai_agent"
    assert order["total_minor"] == product["price_minor"] * 2
    assert order["checkout_url"].endswith(f"/checkout/{order['local_order_id']}")
    assert status["status"] == "pending"


def test_mcp_cart_rejects_unknown_products_without_creating_an_order() -> None:
    with TestClient(app) as client:
        result = _call_tool(
            client,
            "build_validated_cart",
            {"store_slug": "rinas-stall", "items": [{"product_id": 999999, "quantity": 1}]},
        )
    assert "error" in result
