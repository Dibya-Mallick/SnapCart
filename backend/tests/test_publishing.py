from fastapi.testclient import TestClient

from app.api.v1.stores import catalog_publish_errors
from app.db import SessionLocal
from app.main import app
from app.models import Product, Store

client = TestClient(app)


def test_published_store_has_a_valid_catalog() -> None:
    response = client.post("/api/v1/stores/rinas-stall/publish")
    assert response.status_code == 200
    assert response.json()["store_status"] == "published"
    assert response.json()["active_catalog_items"] == 4


def test_publish_rejects_items_needing_review() -> None:
    with SessionLocal() as db:
        store = db.query(Store).filter(Store.slug == "rinas-stall").one()
        product = db.query(Product).filter(Product.store_id == store.id).first()
        assert product is not None
        original_value = product.ai_needs_review
        product.ai_needs_review = True
        db.commit()
        try:
            response = client.post("/api/v1/stores/rinas-stall/publish")
            assert response.status_code == 422
            assert "still needs review" in str(response.json()["detail"])
        finally:
            product.ai_needs_review = original_value
            db.commit()


def test_publish_validation_requires_positive_prices() -> None:
    with SessionLocal() as db:
        store = db.query(Store).filter(Store.slug == "rinas-stall").one()
        product = db.query(Product).filter(Product.store_id == store.id).first()
        assert product is not None
        original_price = product.price_minor
        product.price_minor = None
        try:
            errors = catalog_publish_errors(store, [product])
            assert any("positive price" in error for error in errors)
        finally:
            product.price_minor = original_price
            db.commit()


def test_public_store_and_catalog_hide_draft_state_and_internal_fields() -> None:
    unpublish = client.post("/api/v1/stores/rinas-stall/unpublish")
    assert unpublish.status_code == 200
    try:
        assert client.get("/api/v1/stores/rinas-stall").status_code == 404
        assert client.get("/api/v1/stores/rinas-stall/catalog").status_code == 404
    finally:
        republish = client.post("/api/v1/stores/rinas-stall/publish")
        assert republish.status_code == 200

    store_response = client.get("/api/v1/stores/rinas-stall")
    assert store_response.status_code == 200
    assert store_response.json() == {
        "store_name": "Rina's Stall",
        "store_slug": "rinas-stall",
        "currency": "USD",
        "status": "published",
    }

    catalog_response = client.get("/api/v1/stores/rinas-stall/catalog")
    assert catalog_response.status_code == 200
    body = catalog_response.json()
    assert len(body["products"]) == 4
    assert "source_text" not in body["products"][0]
    assert "ai_needs_review" not in body["products"][0]
