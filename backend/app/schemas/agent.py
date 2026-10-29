from typing import Any, Literal

from pydantic import BaseModel, Field

from app.schemas.orders import CartItemInput, PendingOrderResponse
from app.schemas.storefront import PublicProductResponse


class AgentChatRequest(BaseModel):
    store_slug: str = Field(min_length=1, max_length=120)
    message: str = Field(min_length=1, max_length=1_000)


class AgentToolCall(BaseModel):
    name: str
    arguments: dict[str, Any]
    result: dict[str, Any]


class AgentChatResponse(BaseModel):
    status: Literal["cart_prepared", "needs_clarification"]
    message: str
    tool_calls: list[AgentToolCall]
    order: PendingOrderResponse | None = None


class AgentCatalogResponse(BaseModel):
    store_slug: str
    currency: str
    products: list[PublicProductResponse]


class AgentBuildCartRequest(BaseModel):
    items: list[CartItemInput] = Field(min_length=1, max_length=50)


class AgentPaymentStatusResponse(BaseModel):
    local_order_id: int
    store_slug: str
    status: str
    paypal_order_id: str | None
    paypal_capture_id: str | None
