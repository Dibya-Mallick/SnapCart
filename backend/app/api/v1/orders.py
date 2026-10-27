from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Store
from app.schemas.orders import CreateOrderRequest, OrderItemResponse, PendingOrderResponse
from app.services.order_service import create_validated_order

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("", response_model=PendingOrderResponse, status_code=201)
def create_order(payload: CreateOrderRequest, db: Session = Depends(get_db)) -> PendingOrderResponse:
    store = db.scalar(select(Store).where(Store.slug == payload.store_slug, Store.status == "published"))
    if not store:
        # Keep draft stores indistinguishable from unknown public stores.
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Store not found")

    order = create_validated_order(db, store, payload.items, payload.source)
    return PendingOrderResponse(
        local_order_id=order.id,
        store_slug=store.slug,
        source=order.source,
        status=order.status,
        currency=order.currency,
        subtotal_minor=order.subtotal_minor,
        total_minor=order.total_minor,
        items=[
            OrderItemResponse(
                product_id=item.product_id,
                product_name=item.product_name_snapshot,
                unit_price_minor=item.unit_price_minor_snapshot,
                quantity=item.quantity,
                line_total_minor=item.line_total_minor,
            )
            for item in order.items
        ],
    )
