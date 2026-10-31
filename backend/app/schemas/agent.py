from typing import Any, Literal

from pydantic import BaseModel, Field

from app.schemas.orders import CartItemInput, PendingOrderResponse
from app.schemas.storefront import PublicProductResponse


class AgentChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=2_000)


class AgentChatRequest(BaseModel):
    store_slug: str = Field(min_length=1, max_length=120)
    message: str = Field(min_length=1, max_length=1_000)
    # Earlier turns of this conversation, oldest first, so the agent can follow up.
    history: list[AgentChatTurn] = Field(default_factory=list, max_length=20)


class AgentToolCall(BaseModel):
    name: str
    arguments: dict[str, Any]
    result: dict[str, Any]


class AgentChatResponse(BaseModel):
    status: Literal["cart_prepared", "needs_clarification"]
    message: str
    tool_calls: list[AgentToolCall]
    order: PendingOrderResponse | None = None
    planner: str = "rules"


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
