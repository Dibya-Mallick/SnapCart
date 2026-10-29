"""Server-only PayPal Orders v2 integration.

The service owns OAuth, request headers, order payload construction, and capture
verification. API routes never expose the client secret or OAuth token.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from time import monotonic
from uuid import uuid4

import httpx

from app.core.config import settings
from app.models import Order


class PayPalServiceError(RuntimeError):
    """An upstream PayPal request or response validation failed."""


class PayPalVerificationError(PayPalServiceError):
    """PayPal completed, but its capture did not match the local order."""


@dataclass(frozen=True)
class CreatedPayPalOrder:
    order_id: str
    status: str
    approval_url: str | None


@dataclass(frozen=True)
class CapturedPayPalOrder:
    order_id: str
    capture_id: str


class PayPalService:
    def __init__(self) -> None:
        self._access_token: str | None = None
        self._token_expires_at = 0.0

    def _require_credentials(self) -> None:
        if not settings.paypal_client_id or not settings.paypal_client_secret:
            raise PayPalServiceError("PayPal credentials are not configured")

    def _get_access_token(self) -> str:
        self._require_credentials()
        if self._access_token and monotonic() < self._token_expires_at:
            return self._access_token

        try:
            with httpx.Client(base_url=settings.paypal_base_url, timeout=15.0) as client:
                response = client.post(
                    "/v1/oauth2/token",
                    auth=(settings.paypal_client_id, settings.paypal_client_secret),
                    data={"grant_type": "client_credentials"},
                    headers={"Accept": "application/json", "Accept-Language": "en_US"},
                )
        except httpx.HTTPError as exc:
            raise PayPalServiceError("PayPal OAuth request failed") from exc
        if response.is_error:
            raise PayPalServiceError("PayPal OAuth request was rejected")
        body = response.json()
        token = body.get("access_token")
        expires_in = int(body.get("expires_in", 0))
        if not token or expires_in <= 0:
            raise PayPalServiceError("PayPal OAuth response was invalid")
        self._access_token = token
        self._token_expires_at = monotonic() + max(expires_in - 60, 1)
        return token

    def _request(self, method: str, path: str, json: dict, request_id: str) -> dict:
        token = self._get_access_token()
        try:
            with httpx.Client(base_url=settings.paypal_base_url, timeout=15.0) as client:
                response = client.request(
                    method,
                    path,
                    json=json,
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                        "PayPal-Request-Id": request_id,
                    },
                )
        except httpx.HTTPError as exc:
            raise PayPalServiceError("PayPal API request failed") from exc
        if response.is_error:
            raise PayPalServiceError("PayPal API request was rejected")
        try:
            return response.json()
        except ValueError as exc:
            raise PayPalServiceError("PayPal API returned invalid JSON") from exc

    @staticmethod
    def _money(minor: int) -> str:
        return f"{Decimal(minor) / Decimal(100):.2f}"

    def create_order(self, order: Order) -> CreatedPayPalOrder:
        response = self._request(
            "POST",
            "/v2/checkout/orders",
            {
                "intent": "CAPTURE",
                "purchase_units": [
                    {
                        "reference_id": f"local-order-{order.id}",
                        "amount": {
                            "currency_code": order.currency,
                            "value": self._money(order.total_minor),
                        },
                    }
                ],
                "application_context": {"user_action": "PAY_NOW"},
            },
            request_id=f"snap-a-store-create-{order.id}-{uuid4().hex}",
        )
        paypal_order_id = response.get("id")
        if not paypal_order_id:
            raise PayPalServiceError("PayPal create-order response had no order ID")
        approval_url = next(
            (link.get("href") for link in response.get("links", []) if link.get("rel") == "approve"),
            None,
        )
        return CreatedPayPalOrder(
            order_id=paypal_order_id,
            status=response.get("status", "CREATED"),
            approval_url=approval_url,
        )

    def capture_order(self, order: Order, paypal_order_id: str) -> CapturedPayPalOrder:
        response = self._request(
            "POST",
            f"/v2/checkout/orders/{paypal_order_id}/capture",
            {},
            request_id=f"snap-a-store-capture-{order.id}-{uuid4().hex}",
        )
        if response.get("status") != "COMPLETED":
            raise PayPalVerificationError("PayPal capture was not completed")

        purchase_units = response.get("purchase_units", [])
        captures = purchase_units[0].get("payments", {}).get("captures", []) if purchase_units else []
        capture = captures[0] if captures else {}
        capture_id = capture.get("id")
        amount = capture.get("amount", {})
        if not capture_id:
            raise PayPalVerificationError("PayPal capture response had no capture ID")
        if amount.get("currency_code") != order.currency:
            raise PayPalVerificationError("PayPal capture currency did not match the local order")
        try:
            captured_minor = int(Decimal(amount.get("value", "-1")) * 100)
        except Exception as exc:
            raise PayPalVerificationError("PayPal capture amount was invalid") from exc
        if captured_minor != order.total_minor:
            raise PayPalVerificationError("PayPal capture amount did not match the local order")
        return CapturedPayPalOrder(order_id=paypal_order_id, capture_id=capture_id)
