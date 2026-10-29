import pytest
from fastapi.testclient import TestClient

from app.api.v1.payments import paypal_service
from app.main import app
from app.models import Order
from app.services.paypal_service import (
    CapturedPayPalOrder,
    CreatedPayPalOrder,
    PayPalService,
    PayPalVerificationError,
)


def _create_local_order(client: TestClient) -> dict:
    products = client.get("/api/v1/stores/rinas-stall/catalog").json()["products"]
    return client.post(
        "/api/v1/orders",
        json={
            "store_slug": "rinas-stall",
            "items": [{"product_id": products[0]["id"], "quantity": 1}],
        },
    ).json()


def test_create_and_capture_paypal_order_marks_local_order_paid() -> None:
    original_create = paypal_service.create_order
    original_capture = paypal_service.capture_order
    paypal_service.create_order = lambda order: CreatedPayPalOrder(
        order_id="PAYPAL-ORDER-1", status="CREATED", approval_url="https://paypal.test/approve"
    )
    paypal_service.capture_order = lambda order, paypal_order_id: CapturedPayPalOrder(
        order_id=paypal_order_id, capture_id="CAPTURE-1"
    )
    try:
        with TestClient(app) as client:
            local_order = _create_local_order(client)
            created = client.post(
                "/api/v1/payments/paypal/create-order",
                json={"local_order_id": local_order["local_order_id"]},
            )
            assert created.status_code == 200
            assert created.json()["approval_url"] == "https://paypal.test/approve"

            captured = client.post(
                "/api/v1/payments/paypal/capture-order",
                json={
                    "local_order_id": local_order["local_order_id"],
                    "paypal_order_id": "PAYPAL-ORDER-1",
                },
            )
            assert captured.status_code == 200
            assert captured.json()["status"] == "paid"
            assert captured.json()["paypal_capture_id"] == "CAPTURE-1"
    finally:
        paypal_service.create_order = original_create
        paypal_service.capture_order = original_capture


def test_paid_capture_is_idempotent() -> None:
    original_create = paypal_service.create_order
    original_capture = paypal_service.capture_order
    paypal_service.create_order = lambda order: CreatedPayPalOrder(
        order_id="PAYPAL-ORDER-2", status="CREATED", approval_url=None
    )
    call_count = 0

    def capture_once(order, paypal_order_id):
        nonlocal call_count
        call_count += 1
        return CapturedPayPalOrder(order_id=paypal_order_id, capture_id="CAPTURE-2")

    paypal_service.capture_order = capture_once
    try:
        with TestClient(app) as client:
            local_order = _create_local_order(client)
            client.post(
                "/api/v1/payments/paypal/create-order",
                json={"local_order_id": local_order["local_order_id"]},
            )
            payload = {
                "local_order_id": local_order["local_order_id"],
                "paypal_order_id": "PAYPAL-ORDER-2",
            }
            assert client.post("/api/v1/payments/paypal/capture-order", json=payload).status_code == 200
            second = client.post("/api/v1/payments/paypal/capture-order", json=payload)
            assert second.status_code == 200
            assert call_count == 1
    finally:
        paypal_service.create_order = original_create
        paypal_service.capture_order = original_capture


def test_capture_verification_rejects_amount_mismatch() -> None:
    service = PayPalService()
    service._request = lambda method, path, json, request_id: {
        "status": "COMPLETED",
        "purchase_units": [
            {
                "payments": {
                    "captures": [
                        {
                            "id": "CAPTURE-3",
                            "amount": {"currency_code": "USD", "value": "9.99"},
                        }
                    ]
                }
            }
        ],
    }
    with pytest.raises(PayPalVerificationError):
        service.capture_order(Order(id=3, currency="USD", total_minor=500), "PAYPAL-ORDER-3")
