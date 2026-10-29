from fastapi.testclient import TestClient

from app.main import app


def test_agent_catalog_tool_returns_public_products() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/agent/stores/rinas-stall/catalog")
    assert response.status_code == 200
    assert len(response.json()["products"]) == 4
    assert "source_text" not in response.json()["products"][0]


def test_agent_chat_runs_catalog_and_cart_tools() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/agent/chat",
            json={
                "store_slug": "rinas-stall",
                "message": "Order two vegetable samosas and a mango lassi",
            },
        )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "cart_prepared"
    assert [call["name"] for call in body["tool_calls"]] == [
        "list_store_catalog",
        "build_validated_cart",
    ]
    assert body["order"]["status"] == "pending"
    assert body["order"]["total_minor"] == 500


def test_agent_chat_requests_clarification_for_unknown_request() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/agent/chat",
            json={"store_slug": "rinas-stall", "message": "Find me something surprising"},
        )
    assert response.status_code == 200
    assert response.json()["status"] == "needs_clarification"
    assert response.json()["order"] is None


def test_agent_payment_status_tool_is_read_only() -> None:
    with TestClient(app) as client:
        products = client.get("/api/v1/stores/rinas-stall/catalog").json()["products"]
        order = client.post(
            "/api/v1/orders",
            json={
                "store_slug": "rinas-stall",
                "items": [{"product_id": products[0]["id"], "quantity": 1}],
            },
        ).json()
        response = client.get(
            f"/api/v1/agent/stores/rinas-stall/orders/{order['local_order_id']}/payment-status"
        )
    assert response.status_code == 200
    assert response.json()["status"] == "pending"
