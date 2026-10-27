from fastapi.testclient import TestClient

from app.db import SessionLocal
from app.main import app
from app.models import Order


def test_web_cart_creates_pending_order_from_database_prices() -> None:
    with TestClient(app) as client:
        products = client.get("/api/v1/stores/rinas-stall/catalog").json()["products"]
        response = client.post(
            "/api/v1/orders",
            json={
                "store_slug": "rinas-stall",
                "source": "web",
                "items": [
                    {"product_id": products[0]["id"], "quantity": 2},
                    {"product_id": products[1]["id"], "quantity": 1},
                ],
            },
        )
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "pending"
    assert body["subtotal_minor"] == products[0]["price_minor"] * 2 + products[1]["price_minor"]
    assert body["total_minor"] == body["subtotal_minor"]
    assert body["items"][0]["quantity"] == 2


def test_cart_rejects_product_from_another_store_or_unknown_product() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/orders",
            json={
                "store_slug": "rinas-stall",
                "items": [{"product_id": 999999, "quantity": 1}],
            },
        )
    assert response.status_code == 422
    assert response.json()["detail"]["message"] == "cart contains unavailable products"


def test_order_stores_product_price_and_name_snapshots() -> None:
    with TestClient(app) as client:
        products = client.get("/api/v1/stores/rinas-stall/catalog").json()["products"]
        response = client.post(
            "/api/v1/orders",
            json={
                "store_slug": "rinas-stall",
                "source": "ai_agent",
                "items": [{"product_id": products[0]["id"], "quantity": 1}],
            },
        )
    assert response.status_code == 201
    order_id = response.json()["local_order_id"]
    with SessionLocal() as db:
        order = db.get(Order, order_id)
        assert order is not None
        assert order.source == "ai_agent"
        assert len(order.items) == 1
        assert order.items[0].product_name_snapshot == products[0]["name"]
        assert order.items[0].unit_price_minor_snapshot == products[0]["price_minor"]
