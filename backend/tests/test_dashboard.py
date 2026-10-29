from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_dashboard_summary_has_seeded_store() -> None:
    response = client.get("/api/v1/dashboard/summary")
    assert response.status_code == 200
    body = response.json()
    assert body["store_slug"] == "rinas-stall"
    assert body["catalog_items"] == 4


def test_catalog_product_can_be_updated() -> None:
    products = client.get("/api/v1/dashboard/catalog").json()
    product = products[0]
    response = client.patch(
        f"/api/v1/dashboard/catalog/{product['id']}",
        json={**product, "name": "Vegetable Samosa (Updated)"},
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Vegetable Samosa (Updated)"


def test_catalog_product_can_be_archived() -> None:
    products = client.get("/api/v1/dashboard/catalog").json()
    product = products[-1]
    response = client.delete(f"/api/v1/dashboard/catalog/{product['id']}")
    assert response.status_code == 200
    assert response.json()["is_active"] is False
    active_ids = {item["id"] for item in client.get("/api/v1/dashboard/catalog").json()}
    assert product["id"] not in active_ids
    restored = client.patch(
        f"/api/v1/dashboard/catalog/{product['id']}",
        json={**product, "is_active": True, "ai_needs_review": False},
    )
    assert restored.status_code == 200
    republished = client.post("/api/v1/stores/rinas-stall/publish")
    assert republished.status_code == 200

