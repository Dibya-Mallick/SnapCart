from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str
    price_minor: int | None
    currency: str
    category: str
    dietary_tags: list[str]
    source_text: str
    ai_needs_review: bool
    is_active: bool


class ProductUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    description: str = ""
    price_minor: int | None = Field(default=None, gt=0)
    category: str = Field(default="Other", max_length=80)
    dietary_tags: list[str] = Field(default_factory=list)
    ai_needs_review: bool = False
    is_active: bool = True

    @field_validator("name", "category")
    @classmethod
    def reject_blank_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("value must not be blank")
        return value


class DashboardSummary(BaseModel):
    store_name: str
    store_slug: str
    store_status: str
    catalog_items: int
    items_needing_review: int
    orders_today: int
    paid_orders: int
    pending_orders: int
    total_payment_volume_minor: int
    currency: str


class OrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source: str
    status: str
    currency: str
    total_minor: int
    paypal_capture_id: str | None
    created_at: datetime


class StorePublishResponse(BaseModel):
    store_slug: str
    store_status: str
    active_catalog_items: int
    currency: str

