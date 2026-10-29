from fastapi import APIRouter

from app.api.v1.agent import router as agent_router
from app.api.v1.catalog import router as catalog_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.orders import router as orders_router
from app.api.v1.payments import router as payments_router
from app.api.v1.stores import router as stores_router

api_router = APIRouter()
api_router.include_router(agent_router)
api_router.include_router(dashboard_router)
api_router.include_router(catalog_router)
api_router.include_router(orders_router)
api_router.include_router(payments_router)
api_router.include_router(stores_router)

