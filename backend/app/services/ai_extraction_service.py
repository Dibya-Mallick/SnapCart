"""Vision extraction boundary with a deterministic local provider for demos."""

from pathlib import Path

from pydantic import BaseModel, Field, field_validator


class ExtractedItem(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    description: str = ""
    price: str | None = None
    currency: str = "USD"
    category: str = "Other"
    dietary_tags: list[str] = Field(default_factory=list)
    source_text: str = ""
    needs_review: bool = False
    warnings: list[str] = Field(default_factory=list)

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        value = value.upper().strip()
        if len(value) != 3 or not value.isalpha():
            raise ValueError("currency must be a three-letter code")
        return value


class ExtractionResult(BaseModel):
    items: list[ExtractedItem] = Field(default_factory=list)
    overall_warnings: list[str] = Field(default_factory=list)


def extract_menu(image_path: Path, provider: str = "mock", model_name: str = "") -> ExtractionResult:
    """Extract a menu using the configured provider.

    The mock provider is deterministic so the upload flow works without external
    credentials. A live provider can be added behind this function later.
    """
    if not image_path.exists():
        raise ValueError("uploaded image is missing")
    if provider != "mock":
        raise RuntimeError(f"vision provider '{provider}' is not implemented")
    return ExtractionResult(
        items=[
            ExtractedItem(
                name="Vegetable Samosa",
                description="Crispy pastry with spiced potato and peas",
                price="1.50",
                category="Snacks",
                dietary_tags=["vegetarian", "dairy-free"],
                source_text="Veg Samosa - 1.50",
            ),
            ExtractedItem(
                name="Mango Lassi",
                description="Chilled mango yogurt drink",
                price="2.00",
                category="Drinks",
                dietary_tags=["vegetarian"],
                source_text="Mango Lassi - 2.00",
            ),
            ExtractedItem(
                name="Chef's Special",
                price=None,
                source_text="Chef's Special - price unclear",
                needs_review=True,
                warnings=["Price could not be read from the menu image."],
            ),
        ],
        overall_warnings=[f"Using local mock extraction provider{f' ({model_name})' if model_name else ''}."],
    )

