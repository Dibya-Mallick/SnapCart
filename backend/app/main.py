from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.routing import Route
from starlette.types import Receive, Scope, Send

from app.api.v1.router import api_router
from app.core.config import settings
from app.db import Base, SessionLocal, engine
from app.mcp_server import mcp
from app.services.demo_seed import seed_demo_data


class MCPEndpoint:
    """ASGI endpoint that forwards to the MCP session manager of the current app run."""

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        await mcp.session_manager.handle_request(scope, receive, send)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_demo_data(db)
    # A session manager can only run once, so build a fresh one for every app start.
    mcp._session_manager = None
    mcp.streamable_http_app()
    async with mcp.session_manager.run():
        yield


app = FastAPI(title="Snap-a-Store API", version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router, prefix="/api/v1")


@app.get("/health", tags=["system"])
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "service": "snap-a-store-api",
        "ai": {
            "llm": settings.groq_model
            if settings.groq_enabled and settings.llm_provider == "groq"
            else "rules",
            "vision": settings.vision_provider,
        },
        "paypal_configured": settings.paypal_enabled,
        "mcp_endpoint": "/mcp",
    }


# Streamable HTTP endpoint for external AI agents (see app.mcp_server).
app.router.routes.append(Route("/mcp", endpoint=MCPEndpoint(), methods=["GET", "POST", "DELETE"]))
