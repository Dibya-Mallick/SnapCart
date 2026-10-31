"""Bounded shopping-agent tools and a credential-free orchestration boundary."""

from __future__ import annotations

import re
from collections import defaultdict
from decimal import Decimal
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Order, Product, Store
from app.schemas.agent import AgentToolCall
from app.schemas.orders import CartItemInput, PendingOrderResponse
from app.schemas.storefront import PublicProductResponse
from app.services.order_service import create_validated_order

NUMBER_WORDS = {
    "a": 1,
    "an": 1,
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
}


def published_store(db: Session, store_slug: str) -> Store:
    store = db.scalar(select(Store).where(Store.slug == store_slug, Store.status == "published"))
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    return store


def _public_products(db: Session, store: Store) -> list[Product]:
    return list(
        db.scalars(
            select(Product)
            .where(
                Product.store_id == store.id,
                Product.is_active.is_(True),
                Product.price_minor.is_not(None),
            )
            .order_by(Product.category, Product.id)
        )
    )


def _product_response(product: Product) -> PublicProductResponse:
    return PublicProductResponse.model_validate(product)


def _order_response(order: Order, store_slug: str) -> PendingOrderResponse:
    return PendingOrderResponse(
        local_order_id=order.id,
        store_slug=store_slug,
        source=order.source,
        status=order.status,
        currency=order.currency,
        subtotal_minor=order.subtotal_minor,
        total_minor=order.total_minor,
        items=[
            {
                "product_id": item.product_id,
                "product_name": item.product_name_snapshot,
                "unit_price_minor": item.unit_price_minor_snapshot,
                "quantity": item.quantity,
                "line_total_minor": item.line_total_minor,
            }
            for item in order.items
        ],
    )


class ShoppingAgentService:
    """Expose only catalog lookup, cart preparation, and payment-status tools."""

    def list_store_catalog(self, db: Session, store_slug: str) -> list[PublicProductResponse]:
        store = published_store(db, store_slug)
        return [_product_response(product) for product in _public_products(db, store)]

    def build_validated_cart(
        self,
        db: Session,
        store_slug: str,
        items: list[CartItemInput],
    ) -> PendingOrderResponse:
        store = published_store(db, store_slug)
        order = create_validated_order(db, store, items, source="ai_agent")
        return _order_response(order, store.slug)

    def check_order_payment_status(
        self, db: Session, store_slug: str, local_order_id: int
    ) -> dict[str, Any]:
        store = published_store(db, store_slug)
        order = db.scalar(
            select(Order).where(Order.id == local_order_id, Order.store_id == store.id)
        )
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        return {
            "local_order_id": order.id,
            "store_slug": store.slug,
            "status": order.status,
            "paypal_order_id": order.paypal_order_id,
            "paypal_capture_id": order.paypal_capture_id,
        }

    def orchestrate_message(
        self, db: Session, store_slug: str, message: str
    ) -> tuple[str, str, list[AgentToolCall], PendingOrderResponse | None]:
        """Run a bounded local orchestration loop.

        This deterministic provider keeps the tool contract usable without an AI key.
        A model-backed planner can later call these same three methods.
        """
        catalog = self.list_store_catalog(db, store_slug)
        catalog_result = {"store_slug": store_slug, "products": [item.model_dump() for item in catalog]}
        tool_calls = [
            AgentToolCall(
                name="list_store_catalog",
                arguments={"store_slug": store_slug},
                result=catalog_result,
            )
        ]
        selected = _select_items(message, catalog)
        if not selected:
            return (
                "needs_clarification",
                "I could not match that request to the published menu. Please name an item, category, or dietary preference.",
                tool_calls,
                None,
            )

        items = [
            CartItemInput(product_id=product_id, quantity=quantity)
            for product_id, quantity in selected.items()
        ]
        order = self.build_validated_cart(db, store_slug, items)
        tool_calls.append(
            AgentToolCall(
                name="build_validated_cart",
                arguments={"store_slug": store_slug, "items": [item.model_dump() for item in items]},
                result=order.model_dump(),
            )
        )
        item_summary = ", ".join(f"{item.quantity}× {item.product_name}" for item in order.items)
        return (
            "cart_prepared",
            (
                f"I prepared a pending order for {item_summary}. The server-calculated total is "
                f"{order.currency} {Decimal(order.total_minor) / Decimal(100):.2f}. "
                "Please review and approve payment."
            ),
            tool_calls,
            order,
        )


def _singular(token: str) -> str:
    token = token.lower().strip(".,!?;:")
    if len(token) <= 3:
        return token
    if token.endswith("ies") and len(token) > 4:  # berries -> berry, but pies -> pie
        return token[:-3] + "y"
    # "-es" is only a plural suffix after sibilants or "o" (dishes, mangoes);
    # elsewhere it belongs to the stem (bites -> bite, not bit).
    if token.endswith(("sses", "xes", "zes", "ches", "shes", "oes")):
        return token[:-2]
    if token.endswith("s") and not token.endswith(("ss", "us")):
        return token[:-1]
    return token


def _name_matches(product_name: str, message: str) -> bool:
    message_words = {_singular(word) for word in re.findall(r"[a-z]+", message.lower())}
    core_name = product_name.split("(", 1)[0]
    name_words = [_singular(word) for word in re.findall(r"[a-z]+", core_name.lower())]
    return all(word in message_words for word in name_words)


def _quantity_before(message: str, anchor: str) -> int:
    words = re.findall(r"[a-z]+|\d+", message.lower())
    core_anchor = anchor.split("(", 1)[0]
    anchor_words = [_singular(word) for word in re.findall(r"[a-z]+", core_anchor.lower())]
    for index in range(len(words)):
        window = [_singular(word) for word in words[index:index + len(anchor_words)]]
        if window == anchor_words:
            previous = words[index - 1] if index else "one"
            if previous.isdigit():
                return int(previous)
            return NUMBER_WORDS.get(previous, 1)
    return 1


def _select_items(message: str, catalog: list[PublicProductResponse]) -> dict[int, int]:
    lower_message = message.lower()
    selected: dict[int, int] = defaultdict(int)

    for product in catalog:
        if _name_matches(product.name, lower_message):
            selected[product.id] += _quantity_before(lower_message, product.name)

    requested_tags = [
        tag
        for tag in {tag for product in catalog for tag in product.dietary_tags}
        if tag in lower_message
    ]
    # Categories come from the live catalog, so merchant-defined ones work too.
    message_words = {_singular(word) for word in re.findall(r"[a-z]+", lower_message)}
    for category in sorted({product.category.lower() for product in catalog} - {"other"}):
        alias = _singular(category)
        if alias not in message_words:
            continue
        eligible = [product for product in catalog if product.category.lower() == category]
        if any(product.id in selected for product in eligible):
            # The shopper already named a specific item from this category.
            continue
        tagged = [
            product for product in eligible if all(tag in product.dietary_tags for tag in requested_tags)
        ]
        candidates = tagged or eligible
        if candidates:
            selected[candidates[0].id] += _quantity_before(lower_message, alias)

    budget_match = re.search(r"(?:\$|usd\s*|dollars?\s*)(\d+(?:\.\d{1,2})?)", lower_message)
    if budget_match and selected:
        budget_minor = int(Decimal(budget_match.group(1)) * 100)
        selected = _fit_budget(selected, catalog, budget_minor)
    return dict(selected)


def _fit_budget(
    selected: dict[int, int], catalog: list[PublicProductResponse], budget_minor: int
) -> dict[int, int]:
    prices = {product.id: product.price_minor for product in catalog}
    if sum(prices[product_id] * quantity for product_id, quantity in selected.items()) <= budget_minor:
        return selected
    reduced = dict(selected)
    for product_id in list(reduced):
        while reduced[product_id] > 1 and sum(
            prices[item_id] * quantity for item_id, quantity in reduced.items()
        ) > budget_minor:
            reduced[product_id] -= 1
    return (
        reduced
        if sum(prices[item_id] * quantity for item_id, quantity in reduced.items()) <= budget_minor
        else {}
    )
