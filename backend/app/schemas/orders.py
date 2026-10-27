from typing import Literal

from pydantic import BaseModel, Field


class CartItemInput(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0, le=100)


class CreateOrderRequest(BaseModel):
    store_slug: str = Field(min_length=1, max_length=120)
    source: Literal["web", "ai_agent"] = "web"
    items: list[CartItemInput] = Field(min_length=1, max_length=50)


class OrderItemResponse(BaseModel):
    product_id: int
    product_name: str
    unit_price_minor: int
    quantity: int
    line_total_minor: int


class PendingOrderResponse(BaseModel):
    local_order_id: int
    store_slug: str
    source: str
    status: str
    currency: str
    subtotal_minor: int
    total_minor: int
    items: list[OrderItemResponse]
