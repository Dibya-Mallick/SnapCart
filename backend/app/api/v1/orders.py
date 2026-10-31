from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.db import get_db
from app.models import Order, Store
from app.schemas.orders import (
    CreateOrderRequest,
    OrderDetailResponse,
    OrderItemResponse,
    PendingOrderResponse,
)
from app.services.order_service import create_validated_order

router = APIRouter(prefix="/orders", tags=["orders"])


def _order_response(order: Order, store_slug: str) -> OrderDetailResponse:
    return OrderDetailResponse(
        local_order_id=order.id,
        store_slug=store_slug,
        source=order.source,
        status=order.status,
        currency=order.currency,
        subtotal_minor=order.subtotal_minor,
        total_minor=order.total_minor,
        paypal_order_id=order.paypal_order_id,
        paypal_capture_id=order.paypal_capture_id,
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


@router.post("", response_model=PendingOrderResponse, status_code=201)
def create_order(payload: CreateOrderRequest, db: Session = Depends(get_db)) -> PendingOrderResponse:
    store = db.scalar(select(Store).where(Store.slug == payload.store_slug, Store.status == "published"))
    if not store:
        # Keep draft stores indistinguishable from unknown public stores.
        raise HTTPException(status_code=404, detail="Store not found")

    order = create_validated_order(db, store, payload.items, payload.source)
    # response_model trims the detail-only PayPal fields from this response.
    return _order_response(order, store.slug)


@router.get("/{order_id}", response_model=OrderDetailResponse)
def get_order(order_id: int, db: Session = Depends(get_db)) -> OrderDetailResponse:
    order = db.execute(
        select(Order).options(joinedload(Order.items)).where(Order.id == order_id)
    ).unique().scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return _order_response(order, order.store.slug)
