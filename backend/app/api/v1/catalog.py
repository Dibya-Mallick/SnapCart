from __future__ import annotations

import re
import struct
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db import get_db
from app.models import AIExtraction, Product, Store
from app.services.ai_extraction_service import extract_menu

router = APIRouter(prefix="/catalog", tags=["catalog"])

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_DIMENSION = 12_000


def _image_format_and_dimensions(data: bytes) -> tuple[str, int, int]:
    """Validate common image signatures and read dimensions without decoding pixels."""
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        if len(data) < 24:
            raise ValueError("invalid PNG header")
        width, height = struct.unpack(">II", data[16:24])
        return "png", width, height

    if data.startswith(b"\xff\xd8\xff"):
        cursor = 2
        sof_markers = set(range(0xC0, 0xC4)) | set(range(0xC5, 0xC8))
        sof_markers |= set(range(0xC9, 0xCC)) | set(range(0xCD, 0xD0))
        while cursor + 9 < len(data):
            if data[cursor] != 0xFF:
                cursor += 1
                continue
            marker = data[cursor + 1]
            cursor += 2
            # SOI/EOI, restart markers, TEM, and fill bytes carry no length field.
            if marker in {0x01, 0xD8, 0xD9, 0xFF} or 0xD0 <= marker <= 0xD7:
                if marker == 0xFF:
                    cursor -= 1
                continue
            if cursor + 2 > len(data):
                break
            segment_length = struct.unpack(">H", data[cursor:cursor + 2])[0]
            if marker in sof_markers and cursor + 7 <= len(data):
                height, width = struct.unpack(">HH", data[cursor + 3:cursor + 7])
                return "jpg", width, height
            cursor += segment_length
        raise ValueError("could not read JPEG dimensions")

    if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        if len(data) < 16:
            raise ValueError("invalid WebP header")
        if data[12:16] == b"VP8X" and len(data) >= 30:
            width = 1 + int.from_bytes(data[24:27], "little")
            height = 1 + int.from_bytes(data[27:30], "little")
            return "webp", width, height
        return "webp", 0, 0

    raise ValueError("file signature is not a supported image")


async def _save_upload(upload: UploadFile) -> tuple[Path, int, int]:
    if upload.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="only JPEG, PNG, and WebP images are supported")

    data = await upload.read(settings.max_upload_bytes + 1)
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="image exceeds the upload size limit")
    try:
        extension, width, height = _image_format_and_dimensions(data)
    except ValueError as exc:
        raise HTTPException(status_code=415, detail=str(exc)) from exc
    if width and height and (width > MAX_DIMENSION or height > MAX_DIMENSION):
        raise HTTPException(status_code=422, detail="image dimensions are too large")

    directory = Path(settings.upload_directory)
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f"{uuid4().hex}.{extension}"
    path.write_bytes(data)
    return path, width, height


def _price_to_minor(price: str | None) -> int | None:
    if price is None:
        return None
    try:
        numeric_value = re.search(r"\d+(?:[.,]\d{1,2})?", price.replace(",", ""))
        if not numeric_value:
            return None
        amount = Decimal(numeric_value.group()).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except (InvalidOperation, ValueError):
        return None
    return int(amount * 100) if amount > 0 else None


@router.post("/extract", status_code=status.HTTP_201_CREATED)
async def upload_and_extract(
    file: UploadFile = File(...),
    store_slug: str = Form("rinas-stall"),
    db: Session = Depends(get_db),
) -> dict:
    store = db.scalar(select(Store).where(Store.slug == store_slug))
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    image_path, width, height = await _save_upload(file)
    extraction = AIExtraction(
        image_path=str(image_path),
        status="processing",
        provider=settings.vision_provider,
        model_name=settings.vision_model or "mock-menu-parser",
    )
    db.add(extraction)
    db.commit()
    db.refresh(extraction)

    try:
        result = extract_menu(image_path, settings.vision_provider, extraction.model_name)
        # A new extraction replaces the store's current active draft catalog.
        # Older rows remain as inactive history and cannot block publishing.
        db.query(Product).filter(Product.store_id == store.id, Product.is_active.is_(True)).update(
            {Product.is_active: False}, synchronize_session=False
        )
        store.status = "draft"
        created_products: list[Product] = []
        for item in result.items:
            price_minor = _price_to_minor(item.price)
            product = Product(
                store_id=store.id,
                name=item.name,
                description=item.description,
                price_minor=price_minor,
                currency=item.currency,
                category=item.category,
                dietary_tags=item.dietary_tags,
                source_text=item.source_text,
                ai_needs_review=item.needs_review or price_minor is None,
                is_active=True,
            )
            db.add(product)
            created_products.append(product)

        extraction.status = "completed"
        extraction.result_json = result.model_dump()
        db.commit()
        for product in created_products:
            db.refresh(product)
        return {
            "extraction_id": extraction.id,
            "status": extraction.status,
            "store_slug": store.slug,
            "image": {"path": extraction.image_path, "width": width, "height": height},
            "overall_warnings": result.overall_warnings,
            "products": [
                {
                    "id": product.id,
                    "name": product.name,
                    "price_minor": product.price_minor,
                    "currency": product.currency,
                    "needs_review": product.ai_needs_review,
                }
                for product in created_products
            ],
        }
    except Exception as exc:
        # Discard any partially applied catalog changes (e.g. deactivated products)
        # so a failed extraction leaves the current catalog untouched.
        db.rollback()
        extraction.status = "failed"
        extraction.error_code = type(exc).__name__
        db.commit()
        raise HTTPException(status_code=502, detail="menu extraction failed") from exc
