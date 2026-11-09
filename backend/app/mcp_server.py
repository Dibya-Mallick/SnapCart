"""MCP server that lets external AI agents shop Snap-a-Store merchants.

Agents (Claude, ChatGPT, custom agents) can discover stores, read a published menu,
and build a server-priced pending order. They cannot pay: every cart comes back
with a checkout link where the human approves the payment in PayPal.

Run over stdio for desktop clients:   python -m app.mcp_server
Over HTTP it is mounted on the API at /mcp (see app.main).
"""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.core.config import settings
from app.db import SessionLocal
from app.models import Store
from app.schemas.orders import CartItemInput
from app.services.shopping_agent_service import ShoppingAgentService

INSTRUCTIONS = """
Snap-a-Store hosts small food merchants who turned a photo of their paper menu into an
online store. Use these tools to shop on a person's behalf:
1. list_stores to find a store, 2. get_store_catalog to read its menu and prices,
3. build_validated_cart with product ids and quantities.
The server sets every price. You cannot take payment: give the person the returned
checkout_url so they can review the order and approve it with PayPal, then use
check_order_payment_status to confirm it was paid.
""".strip()

mcp = FastMCP(
    "snap-a-store",
    instructions=INSTRUCTIONS,
    streamable_http_path="/mcp",
    stateless_http=True,
    json_response=True,
    # The hosted API runs behind a proxy with its own hostname; tools are public anyway.
    transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
)
service = ShoppingAgentService()


class CartLine(BaseModel):
    product_id: int = Field(description="Product id from get_store_catalog")
    quantity: int = Field(ge=1, le=100, description="How many to order")


def checkout_url(local_order_id: int) -> str:
    return f"{settings.public_app_url.rstrip('/')}/checkout/{local_order_id}"


def _tool_error(exc: HTTPException) -> dict[str, Any]:
    return {"error": exc.detail}


@mcp.tool()
def list_stores() -> dict[str, Any]:
    """List published Snap-a-Store merchants with their slug, name, currency and item count."""
    with SessionLocal() as db:
        stores = db.scalars(select(Store).where(Store.status == "published").order_by(Store.name)).all()
        return {
            "stores": [
                {
                    "store_slug": store.slug,
                    "name": store.name,
                    "currency": store.currency,
                    "items": sum(
                        1 for product in store.products if product.is_active and product.price_minor
                    ),
                    "storefront_url": f"{settings.public_app_url.rstrip('/')}/store/{store.slug}",
                }
                for store in stores
            ]
        }


@mcp.tool()
def get_store_catalog(store_slug: str) -> dict[str, Any]:
    """Read a store's published menu. Prices are integers in minor units (150 = 1.50)."""
    with SessionLocal() as db:
        try:
            products = service.list_store_catalog(db, store_slug)
        except HTTPException as exc:
            return _tool_error(exc)
        return {"store_slug": store_slug, "products": [product.model_dump() for product in products]}


@mcp.tool()
def build_validated_cart(store_slug: str, items: list[CartLine]) -> dict[str, Any]:
    """Create a pending order. The server prices it; nothing is charged.

    Returns the order and a checkout_url the human must open to approve payment with PayPal.
    """
    with SessionLocal() as db:
        try:
            order = service.build_validated_cart(
                db, store_slug, [CartItemInput(product_id=line.product_id, quantity=line.quantity) for line in items]
            )
        except HTTPException as exc:
            db.rollback()
            return _tool_error(exc)
        return {
            **order.model_dump(),
            "checkout_url": checkout_url(order.local_order_id),
            "next_step": "Share checkout_url with the shopper; they approve the payment in PayPal.",
        }


@mcp.tool()
def check_order_payment_status(store_slug: str, local_order_id: int) -> dict[str, Any]:
    """Check whether an order prepared earlier is pending, paid, or failed."""
    with SessionLocal() as db:
        try:
            return service.check_order_payment_status(db, store_slug, local_order_id)
        except HTTPException as exc:
            return _tool_error(exc)


def ensure_database() -> None:
    from app.db import Base, engine
    from app.services.demo_seed import seed_demo_data

    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_demo_data(db)


if __name__ == "__main__":
    ensure_database()
    mcp.run()
