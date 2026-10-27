from pydantic import BaseModel, ConfigDict


class PublicProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str
    price_minor: int
    currency: str
    category: str
    dietary_tags: list[str]


class PublicStoreResponse(BaseModel):
    store_name: str
    store_slug: str
    currency: str
    status: str


class PublicCatalogResponse(BaseModel):
    store_name: str
    store_slug: str
    currency: str
    products: list[PublicProductResponse]
