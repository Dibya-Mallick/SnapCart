from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.agent import (
    AgentBuildCartRequest,
    AgentCatalogResponse,
    AgentChatRequest,
    AgentChatResponse,
    AgentPaymentStatusResponse,
)
from app.services.shopping_agent_service import ShoppingAgentService, published_store

router = APIRouter(prefix="/agent", tags=["shopping-agent"])
agent_service = ShoppingAgentService()


@router.get("/stores/{slug}/catalog", response_model=AgentCatalogResponse)
def list_store_catalog(slug: str, db: Session = Depends(get_db)) -> AgentCatalogResponse:
    store = published_store(db, slug)
    products = agent_service.list_store_catalog(db, slug)
    return AgentCatalogResponse(store_slug=slug, currency=store.currency, products=products)


@router.post("/stores/{slug}/cart", response_model=AgentChatResponse)
def build_validated_cart(
    slug: str, payload: AgentBuildCartRequest, db: Session = Depends(get_db)
) -> AgentChatResponse:
    order = agent_service.build_validated_cart(db, slug, payload.items)
    return AgentChatResponse(
        status="cart_prepared",
        message="I prepared a pending order. Please review and approve payment.",
        tool_calls=[],
        order=order,
    )


@router.get(
    "/stores/{slug}/orders/{local_order_id}/payment-status",
    response_model=AgentPaymentStatusResponse,
)
def check_order_payment_status(
    slug: str, local_order_id: int, db: Session = Depends(get_db)
) -> AgentPaymentStatusResponse:
    return AgentPaymentStatusResponse(
        **agent_service.check_order_payment_status(db, slug, local_order_id)
    )


@router.post("/chat", response_model=AgentChatResponse)
def chat(payload: AgentChatRequest, db: Session = Depends(get_db)) -> AgentChatResponse:
    outcome = agent_service.orchestrate_message(
        db,
        payload.store_slug,
        payload.message,
        [turn.model_dump() for turn in payload.history],
    )
    return AgentChatResponse(
        status=outcome.status,
        message=outcome.message,
        tool_calls=outcome.tool_calls,
        order=outcome.order,
        planner=outcome.planner,
    )
