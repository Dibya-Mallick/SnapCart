"""Vision extraction boundary with mock and Gemini providers."""

from pathlib import Path

from pydantic import BaseModel, Field, field_validator

from app.core.config import settings


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


VISION_PROMPT = """
Extract every menu product visibly present in this image. Return only products and
prices that are visible; never invent a name, ingredient, dietary tag, or price.
Preserve the exact visible product text in source_text. If a name or price is
unreadable or ambiguous, set price to null, set needs_review to true, and explain
the problem in warnings. Use an empty string for missing descriptions and the
currency code USD unless another currency is clearly visible.
""".strip()


def _extract_with_gemini(image_path: Path, model_name: str) -> ExtractionResult:
    if not settings.vision_api_key:
        raise RuntimeError("VISION_API_KEY is required for the Gemini provider")
    try:
        from google import genai
        from google.genai import types
    except ImportError as exc:
        raise RuntimeError("install google-genai to use the Gemini provider") from exc

    mime_types = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
    mime_type = mime_types.get(image_path.suffix.lower())
    if not mime_type:
        raise RuntimeError("unsupported image type for Gemini")

    client = genai.Client(api_key=settings.vision_api_key)
    response = client.models.generate_content(
        model=model_name,
        contents=[
            types.Part.from_bytes(data=image_path.read_bytes(), mime_type=mime_type),
            VISION_PROMPT,
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ExtractionResult,
        ),
    )
    if not response.text:
        raise RuntimeError("Gemini returned an empty extraction response")
    return ExtractionResult.model_validate_json(response.text)


def extract_menu(image_path: Path, provider: str = "mock", model_name: str = "") -> ExtractionResult:
    """Extract a menu using the configured provider.

    The mock provider is deterministic so the upload flow works without external
    credentials. A live provider can be added behind this function later.
    """
    if not image_path.exists():
        raise ValueError("uploaded image is missing")
    provider = provider.strip().lower()
    if provider == "gemini":
        return _extract_with_gemini(image_path, model_name or "gemini-3.8-flash")
    if provider != "mock":
        raise RuntimeError(f"vision provider '{provider}' is not supported")
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

