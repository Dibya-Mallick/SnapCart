from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Order, Product, Store
from app.schemas.dashboard import DashboardSummary, OrderResponse, ProductResponse, ProductUpdate

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def get_store_or_404(db: Session, slug: str = "rinas-stall") -> Store:
    store = db.scalar(select(Store).where(Store.slug == slug))
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    return store


@router.get("/summary", response_model=DashboardSummary)
def get_summary(db: Session = Depends(get_db), store_slug: str = Query("rinas-stall")) -> DashboardSummary:
    store = get_store_or_404(db, store_slug)
    start_of_day = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    products = db.scalars(select(Product).where(Product.store_id == store.id)).all()
    orders = db.scalars(select(Order).where(Order.store_id == store.id)).all()
    paid = [order for order in orders if order.status == "paid"]
    return DashboardSummary(
        store_name=store.name,
        store_slug=store.slug,
        store_status=store.status,
        catalog_items=sum(product.is_active for product in products),
        items_needing_review=sum(product.ai_needs_review for product in products if product.is_active),
        orders_today=sum(order.created_at >= start_of_day for order in orders),
        paid_orders=len(paid),
        pending_orders=sum(order.status == "pending" for order in orders),
        total_payment_volume_minor=sum(order.total_minor for order in paid),
        currency=store.currency,
    )


@router.get("/catalog", response_model=list[ProductResponse])
def get_catalog(db: Session = Depends(get_db), store_slug: str = Query("rinas-stall")) -> list[Product]:
    store = get_store_or_404(db, store_slug)
    return list(
        db.scalars(
            select(Product)
            .where(Product.store_id == store.id, Product.is_active.is_(True))
            .order_by(Product.id)
        )
    )


@router.patch("/catalog/{product_id}", response_model=ProductResponse)
def update_catalog_product(
    product_id: int,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    store_slug: str = Query("rinas-stall"),
) -> Product:
    store = get_store_or_404(db, store_slug)
    product = db.scalar(select(Product).where(Product.id == product_id, Product.store_id == store.id))
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    for field, value in payload.model_dump().items():
        setattr(product, field, value)
    if product.price_minor is None:
        product.ai_needs_review = True
    db.commit()
    db.refresh(product)
    return product


@router.delete("/catalog/{product_id}", response_model=ProductResponse)
def archive_catalog_product(
    product_id: int,
    db: Session = Depends(get_db),
    store_slug: str = Query("rinas-stall"),
) -> Product:
    store = get_store_or_404(db, store_slug)
    product = db.scalar(select(Product).where(Product.id == product_id, Product.store_id == store.id))
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.is_active = False
    if store.status == "published":
        store.status = "draft"
    db.commit()
    db.refresh(product)
    return product


@router.get("/orders", response_model=list[OrderResponse])
def get_orders(db: Session = Depends(get_db), store_slug: str = Query("rinas-stall"), status: str | None = None) -> list[Order]:
    store = get_store_or_404(db, store_slug)
    query = select(Order).where(Order.store_id == store.id).order_by(Order.created_at.desc())
    if status:
        query = query.where(Order.status == status)
    return list(db.scalars(query))

