from pydantic import BaseModel, Field


class CreatePayPalOrderRequest(BaseModel):
    local_order_id: int = Field(gt=0)


class CreatePayPalOrderResponse(BaseModel):
    local_order_id: int
    paypal_order_id: str
    paypal_status: str
    approval_url: str | None
    currency: str
    total_minor: int


class CapturePayPalOrderRequest(BaseModel):
    local_order_id: int = Field(gt=0)
    paypal_order_id: str = Field(min_length=1, max_length=36)


class CapturePayPalOrderResponse(BaseModel):
    local_order_id: int
    paypal_order_id: str
    paypal_capture_id: str
    status: str
    currency: str
    total_minor: int
