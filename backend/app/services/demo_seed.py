from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Merchant, Product, Store


def seed_demo_data(db: Session) -> None:
    if db.scalar(select(Store).where(Store.slug == "rinas-stall")):
        return

    merchant = Merchant(display_name="Rina Ahmed")
    store = Store(merchant=merchant, name="Rina's Stall", slug="rinas-stall", status="published")
    store.products = [
        Product(name="Vegetable Samosa", description="Crispy pastry with spiced potato and peas", price_minor=150, category="Snacks", dietary_tags=["vegetarian", "dairy-free"]),
        Product(name="Mango Lassi", description="Chilled mango yogurt drink", price_minor=200, category="Drinks", dietary_tags=["vegetarian"]),
        Product(name="Chaat Bites", description="Tangy chickpea and potato street snack", price_minor=250, category="Snacks", dietary_tags=["vegetarian", "dairy-free"]),
        Product(name="Chicken Roll", description="Spiced chicken wrapped in flatbread", price_minor=350, category="Mains", dietary_tags=[]),
    ]
    db.add(merchant)
    db.commit()

