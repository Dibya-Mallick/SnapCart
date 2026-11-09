from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func, select
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
    # Aggregate in SQL so the summary stays cheap as the order history grows.
    catalog_items, items_needing_review = db.execute(
        select(
            func.count(Product.id),
            func.coalesce(func.sum(case((Product.ai_needs_review.is_(True), 1), else_=0)), 0),
        ).where(Product.store_id == store.id, Product.is_active.is_(True))
    ).one()
    orders_today, paid_orders, pending_orders, payment_volume = db.execute(
        select(
            func.coalesce(func.sum(case((Order.created_at >= start_of_day, 1), else_=0)), 0),
            func.coalesce(func.sum(case((Order.status == "paid", 1), else_=0)), 0),
            func.coalesce(func.sum(case((Order.status == "pending", 1), else_=0)), 0),
            func.coalesce(
                func.sum(case((Order.status == "paid", Order.total_minor), else_=0)), 0
            ),
        ).where(Order.store_id == store.id)
    ).one()
    return DashboardSummary(
        store_name=store.name,
        store_slug=store.slug,
        store_status=store.status,
        catalog_items=catalog_items,
        items_needing_review=items_needing_review,
        orders_today=orders_today,
        paid_orders=paid_orders,
        pending_orders=pending_orders,
        total_payment_volume_minor=payment_volume,
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

