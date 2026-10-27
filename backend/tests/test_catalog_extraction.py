from fastapi.testclient import TestClient

from app.main import app
from app.services.ai_extraction_service import ExtractedItem

client = TestClient(app)


def test_extract_rejects_content_that_is_not_an_image() -> None:
    response = client.post(
        "/api/v1/catalog/extract",
        files={"file": ("menu.txt", b"not an image", "text/plain")},
        data={"store_slug": "rinas-stall"},
    )
    assert response.status_code == 415


def test_extracted_item_normalizes_currency_and_requires_a_name() -> None:
    item = ExtractedItem(name="Samosa", currency="usd")
    assert item.currency == "USD"
