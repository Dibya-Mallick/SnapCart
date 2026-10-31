"""LLM planner for the shopping agent, using Groq tool calling over bounded tools.

The model never sees payment credentials and has no tool that moves money: it can
read the published menu, ask the server to build a priced cart, and read payment
status. The shopper approves every payment in PayPal.
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.schemas.agent import AgentToolCall
from app.schemas.orders import CartItemInput, PendingOrderResponse
from app.services.groq_client import chat_completion

if TYPE_CHECKING:
    from app.services.shopping_agent_service import AgentOutcome, ShoppingAgentService

MAX_TOOL_ROUNDS = 4
MAX_HISTORY_TURNS = 8

TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "list_store_catalog",
            "description": "List the store's published products with ids, prices in minor units (cents), categories and dietary tags.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "build_validated_cart",
            "description": (
                "Create a pending order from product ids and quantities. The server looks up "
                "every price itself and returns the authoritative total. This does not charge "
                "anyone; the shopper approves payment in PayPal afterwards."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "items": {
                        "type": "array",
                        "minItems": 1,
                        "items": {
                            "type": "object",
                            "properties": {
                                "product_id": {"type": "integer"},
                                "quantity": {"type": "integer", "minimum": 1, "maximum": 100},
                            },
                            "required": ["product_id", "quantity"],
                        },
                    }
                },
                "required": ["items"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_order_payment_status",
            "description": "Read whether a previously prepared order is pending, paid, or failed.",
            "parameters": {
                "type": "object",
                "properties": {"local_order_id": {"type": "integer"}},
                "required": ["local_order_id"],
            },
        },
    },
]


def _system_prompt(store_name: str) -> str:
    return (
        f"You are the shopping assistant for {store_name}, a small food business. "
        "Help the shopper choose items from this store's published menu only.\n"
        "Rules:\n"
        "- Use only products and product ids returned by list_store_catalog. Never invent items or prices.\n"
        "- Describe dietary suitability only with the exact dietary_tags listed. If the shopper needs a "
        "tag that no product has (for example vegan), say which tags the closest items do have and let "
        "them decide; never claim an item meets a requirement it is not tagged with.\n"
        "- When the shopper has said what they want, call build_validated_cart. Respect any budget "
        "they mention by checking prices before choosing quantities.\n"
        "- If a request is ambiguous or nothing on the menu fits, ask one short clarifying question "
        "instead of guessing.\n"
        "- You cannot take payment. After building a cart, tell the shopper to review it and approve "
        "the payment with PayPal. Quote the total exactly as the tool returned it.\n"
        "- Keep replies to two or three friendly sentences. Prices are in minor units (150 = $1.50)."
    )


def _execute_tool(
    service: ShoppingAgentService, db: Session, store_slug: str, name: str, args: dict[str, Any]
) -> dict[str, Any]:
    try:
        if name == "list_store_catalog":
            products = service.list_store_catalog(db, store_slug)
            return {"store_slug": store_slug, "products": [product.model_dump() for product in products]}
        if name == "build_validated_cart":
            items = [CartItemInput.model_validate(item) for item in args.get("items") or []]
            if not items:
                return {"error": "items must contain at least one product"}
            return service.build_validated_cart(db, store_slug, items).model_dump()
        if name == "check_order_payment_status":
            return service.check_order_payment_status(db, store_slug, int(args.get("local_order_id", 0)))
    except HTTPException as exc:
        # Undo any partially flushed order before reporting the problem to the model.
        db.rollback()
        return {"error": exc.detail}
    except (ValidationError, TypeError, ValueError) as exc:
        db.rollback()
        return {"error": f"invalid arguments: {exc}"}
    return {"error": f"unknown tool {name}"}


def run_llm_agent(
    service: ShoppingAgentService,
    db: Session,
    store_slug: str,
    message: str,
    history: list[dict[str, str]],
) -> AgentOutcome:
    from app.services.shopping_agent_service import AgentOutcome, published_store

    store = published_store(db, store_slug)
    tool_log: list[AgentToolCall] = []
    order: PendingOrderResponse | None = None

    # Ground every turn in the live menu by running the catalog tool up front.
    catalog = _execute_tool(service, db, store_slug, "list_store_catalog", {})
    tool_log.append(AgentToolCall(name="list_store_catalog", arguments={"store_slug": store_slug}, result=catalog))
    messages: list[dict[str, Any]] = [{"role": "system", "content": _system_prompt(store.name)}]
    for turn in history[-MAX_HISTORY_TURNS:]:
        if turn.get("role") in {"user", "assistant"} and turn.get("content"):
            messages.append({"role": turn["role"], "content": turn["content"][:2000]})
    messages += [
        {"role": "user", "content": message},
        {
            "role": "assistant",
            "content": "",
            "tool_calls": [{"id": "catalog-0", "type": "function", "function": {"name": "list_store_catalog", "arguments": "{}"}}],
        },
        {"role": "tool", "tool_call_id": "catalog-0", "content": json.dumps(catalog)},
    ]

    reply_text = ""
    for _ in range(MAX_TOOL_ROUNDS):
        reply = chat_completion(messages, tools=TOOLS)
        calls = reply.get("tool_calls") or []
        if not calls:
            reply_text = (reply.get("content") or "").strip()
            break
        messages.append({"role": "assistant", "content": reply.get("content") or "", "tool_calls": calls})
        for call in calls:
            name = call.get("function", {}).get("name", "")
            try:
                args = json.loads(call.get("function", {}).get("arguments") or "{}")
            except json.JSONDecodeError:
                args = {}
            result = _execute_tool(service, db, store_slug, name, args if isinstance(args, dict) else {})
            if name == "build_validated_cart" and "error" not in result:
                order = PendingOrderResponse.model_validate(result)
            tool_log.append(AgentToolCall(name=name, arguments=args if isinstance(args, dict) else {}, result=result))
            messages.append({"role": "tool", "tool_call_id": call.get("id", name), "content": json.dumps(result)})

    if not reply_text:
        reply_text = (
            "Your cart is ready. Please review it and approve the payment with PayPal."
            if order
            else "Could you tell me a bit more about what you'd like from the menu?"
        )
    return AgentOutcome(
        status="cart_prepared" if order else "needs_clarification",
        message=reply_text,
        tool_calls=tool_log,
        order=order,
        planner=f"groq:{settings.groq_model}",
    )
