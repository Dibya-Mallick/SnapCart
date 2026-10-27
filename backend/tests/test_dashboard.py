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

