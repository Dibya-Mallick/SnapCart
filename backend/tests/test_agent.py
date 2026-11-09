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


def test_singular_keeps_stems_that_end_in_e() -> None:
    from app.services.shopping_agent_service import _singular

    assert _singular("bites") == "bite"
    assert _singular("samosas") == "samosa"
    assert _singular("mangoes") == "mango"
    assert _singular("dishes") == "dish"
    assert _singular("berries") == "berry"
    assert _singular("pies") == "pie"
    assert _singular("glass") == "glass"


def test_agent_matches_singular_form_of_plural_product_name() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/agent/chat",
            json={"store_slug": "rinas-stall", "message": "One chaat bite please"},
        )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "cart_prepared"
    assert [item["product_name"] for item in body["order"]["items"]] == ["Chaat Bites"]


def test_agent_category_request_uses_catalog_categories() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/agent/chat",
            json={"store_slug": "rinas-stall", "message": "I'd like a drink"},
        )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "cart_prepared"
    assert [item["product_name"] for item in body["order"]["items"]] == ["Mango Lassi"]


def test_agent_matches_product_by_its_head_noun() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/agent/chat",
            json={"store_slug": "rinas-stall", "message": "Two samosas and a mango lassi"},
        )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "cart_prepared"
    quantities = {item["product_name"]: item["quantity"] for item in body["order"]["items"]}
    assert quantities == {"Vegetable Samosa": 2, "Mango Lassi": 1}
