from collections import Counter

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Order, OrderItem, Product, Store
from app.schemas.orders import CartItemInput


def create_validated_order(
    db: Session,
    store: Store,
    items: list[CartItemInput],
    source: str,
) -> Order:
    """Create a pending order using only prices read from the published catalog."""
    if store.status != "published":
        raise HTTPException(status_code=404, detail="Store not found")

    requested_quantities: Counter[int] = Counter()
    for item in items:
        requested_quantities[item.product_id] += item.quantity
    product_ids = list(requested_quantities)
    products_by_id = {
        product.id: product
        for product in db.scalars(
            select(Product).where(
                Product.store_id == store.id,
                Product.id.in_(product_ids),
                Product.is_active.is_(True),
            )
        )
    }
    missing_ids = [product_id for product_id in product_ids if product_id not in products_by_id]
    if missing_ids:
        raise HTTPException(
            status_code=422,
            detail={"message": "cart contains unavailable products", "product_ids": missing_ids},
        )

    order = Order(store_id=store.id, source=source, status="pending", currency=store.currency)
    db.add(order)
    db.flush()

    subtotal_minor = 0
    for item in items:
        product = products_by_id[item.product_id]
        if product.price_minor is None or product.price_minor <= 0:
            raise HTTPException(
                status_code=422,
                detail=f"product {product.id} does not have a valid price",
            )
        quantity = requested_quantities[product.id]
        line_total_minor = product.price_minor * quantity
        subtotal_minor += line_total_minor
        db.add(
            OrderItem(
                order_id=order.id,
                product_id=product.id,
                product_name_snapshot=product.name,
                unit_price_minor_snapshot=product.price_minor,
                quantity=quantity,
                line_total_minor=line_total_minor,
            )
        )

    order.subtotal_minor = subtotal_minor
    order.total_minor = subtotal_minor
    db.commit()
    db.refresh(order)
    return order
