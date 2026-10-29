from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.db import get_db
from app.models import Order
from app.schemas.payments import (
    CapturePayPalOrderRequest,
    CapturePayPalOrderResponse,
    CreatePayPalOrderRequest,
    CreatePayPalOrderResponse,
)
from app.services.paypal_service import PayPalService, PayPalServiceError, PayPalVerificationError

router = APIRouter(prefix="/payments/paypal", tags=["paypal"])
paypal_service = PayPalService()


def get_order_or_404(db: Session, local_order_id: int) -> Order:
    order = db.execute(
        select(Order)
        .options(joinedload(Order.items))
        .where(Order.id == local_order_id)
    ).unique().scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.post("/create-order", response_model=CreatePayPalOrderResponse)
def create_paypal_order(
    payload: CreatePayPalOrderRequest, db: Session = Depends(get_db)
) -> CreatePayPalOrderResponse:
    order = get_order_or_404(db, payload.local_order_id)
    if order.status != "pending":
        raise HTTPException(status_code=409, detail="Only pending orders can start PayPal checkout")
    if order.paypal_order_id:
        return CreatePayPalOrderResponse(
            local_order_id=order.id,
            paypal_order_id=order.paypal_order_id,
            paypal_status="CREATED",
            approval_url=None,
            currency=order.currency,
            total_minor=order.total_minor,
        )
    try:
        created = paypal_service.create_order(order)
    except PayPalServiceError as exc:
        raise HTTPException(status_code=502, detail="PayPal order creation failed") from exc
    order.paypal_order_id = created.order_id
    db.commit()
    return CreatePayPalOrderResponse(
        local_order_id=order.id,
        paypal_order_id=created.order_id,
        paypal_status=created.status,
        approval_url=created.approval_url,
        currency=order.currency,
        total_minor=order.total_minor,
    )


@router.post("/capture-order", response_model=CapturePayPalOrderResponse)
def capture_paypal_order(
    payload: CapturePayPalOrderRequest, db: Session = Depends(get_db)
) -> CapturePayPalOrderResponse:
    order = get_order_or_404(db, payload.local_order_id)
    if order.status == "paid":
        if order.paypal_order_id != payload.paypal_order_id or not order.paypal_capture_id:
            raise HTTPException(status_code=409, detail="PayPal order does not match local payment")
        return CapturePayPalOrderResponse(
            local_order_id=order.id,
            paypal_order_id=order.paypal_order_id,
            paypal_capture_id=order.paypal_capture_id,
            status=order.status,
            currency=order.currency,
            total_minor=order.total_minor,
        )
    if order.status != "pending":
        raise HTTPException(status_code=409, detail="Only pending orders can be captured")
    if order.paypal_order_id and order.paypal_order_id != payload.paypal_order_id:
        raise HTTPException(status_code=409, detail="PayPal order does not match local payment")
    if not order.paypal_order_id:
        raise HTTPException(status_code=409, detail="Create the PayPal order before capturing it")

    try:
        captured = paypal_service.capture_order(order, payload.paypal_order_id)
    except PayPalVerificationError as exc:
        order.status = "failed"
        db.commit()
        raise HTTPException(status_code=502, detail="PayPal capture verification failed") from exc
    except PayPalServiceError as exc:
        raise HTTPException(status_code=502, detail="PayPal capture failed") from exc

    order.paypal_capture_id = captured.capture_id
    order.status = "paid"
    db.commit()
    return CapturePayPalOrderResponse(
        local_order_id=order.id,
        paypal_order_id=payload.paypal_order_id,
        paypal_capture_id=captured.capture_id,
        status=order.status,
        currency=order.currency,
        total_minor=order.total_minor,
    )
