from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Product, Store
from app.schemas.dashboard import StorePublishResponse
from app.schemas.storefront import PublicCatalogResponse, PublicProductResponse, PublicStoreResponse

router = APIRouter(prefix="/stores", tags=["stores"])


def get_store_or_404(db: Session, slug: str) -> Store:
    store = db.scalar(select(Store).where(Store.slug == slug))
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    return store


def get_published_store_or_404(db: Session, slug: str) -> Store:
    store = db.scalar(select(Store).where(Store.slug == slug, Store.status == "published"))
    if not store:
        # Do not reveal whether a draft store exists at this public endpoint.
        raise HTTPException(status_code=404, detail="Store not found")
    return store


@router.get("/{slug}", response_model=PublicStoreResponse)
def get_public_store(slug: str, db: Session = Depends(get_db)) -> PublicStoreResponse:
    store = get_published_store_or_404(db, slug)
    return PublicStoreResponse(
        store_name=store.name,
        store_slug=store.slug,
        currency=store.currency,
        status=store.status,
    )


@router.get("/{slug}/catalog", response_model=PublicCatalogResponse)
def get_public_catalog(slug: str, db: Session = Depends(get_db)) -> PublicCatalogResponse:
    store = get_published_store_or_404(db, slug)
    products = list(
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
    return PublicCatalogResponse(
        store_name=store.name,
        store_slug=store.slug,
        currency=store.currency,
        products=[PublicProductResponse.model_validate(product) for product in products],
    )


def catalog_publish_errors(store: Store, products: list[Product]) -> list[str]:
    active_products = [product for product in products if product.is_active]
    errors: list[str] = []
    if not active_products:
        errors.append("at least one active catalog item is required")
    for product in active_products:
        if not product.name.strip():
            errors.append(f"product {product.id} has an empty name")
        if product.price_minor is None or product.price_minor <= 0:
            errors.append(f"product {product.id} must have a positive price")
        if product.currency != store.currency:
            errors.append(f"product {product.id} currency must be {store.currency}")
        if product.ai_needs_review:
            errors.append(f"product {product.id} still needs review")
    return errors


def _publish_response(store: Store, products: list[Product]) -> StorePublishResponse:
    return StorePublishResponse(
        store_slug=store.slug,
        store_status=store.status,
        active_catalog_items=sum(product.is_active for product in products),
        currency=store.currency,
    )


@router.post("/{slug}/publish", response_model=StorePublishResponse)
def publish_store(slug: str, db: Session = Depends(get_db)) -> StorePublishResponse:
    store = get_store_or_404(db, slug)
    products = list(db.scalars(select(Product).where(Product.store_id == store.id)))
    errors = catalog_publish_errors(store, products)
    if errors:
        raise HTTPException(
            status_code=422,
            detail={"message": "catalog cannot be published", "errors": errors},
        )
    store.status = "published"
    db.commit()
    db.refresh(store)
    return _publish_response(store, products)


@router.post("/{slug}/unpublish", response_model=StorePublishResponse)
def unpublish_store(slug: str, db: Session = Depends(get_db)) -> StorePublishResponse:
    store = get_store_or_404(db, slug)
    products = list(db.scalars(select(Product).where(Product.store_id == store.id)))
    store.status = "draft"
    db.commit()
    db.refresh(store)
    return _publish_response(store, products)
