from __future__ import annotations

import unicodedata
from typing import Final

from generator._ids import menu_item_id
from generator.config import GeneratorConfig
from generator.domain import MenuItem, money_cents

_MENU_ITEMS: Final[tuple[tuple[str, str, int], ...]] = (
    ("Crispy Calamari", "appetizer", 1499),
    ("Garlic Bread", "appetizer", 799),
    ("Caesar Salad", "appetizer", 1199),
    ("Bruschetta", "appetizer", 999),
    ("Chicken Wings", "appetizer", 1599),
    ("Soup of the Day", "appetizer", 899),
    ("Mozzarella Sticks", "appetizer", 1099),
    ("Loaded Nachos", "appetizer", 1699),
    ("Classic Burger", "main", 1899),
    ("Chicken Club", "main", 1799),
    ("Steak Frites", "main", 3499),
    ("Grilled Salmon", "main", 2999),
    ("Pasta Alfredo", "main", 2199),
    ("Pasta Bolognese", "main", 2299),
    ("Fish and Chips", "main", 2099),
    ("Veggie Bowl", "main", 1899),
    ("BBQ Ribs", "main", 3299),
    ("Chicken Parmesan", "main", 2499),
    ("Margherita Pizza", "main", 1999),
    ("Pepperoni Pizza", "main", 2199),
    ("House Lemonade", "drink", 499),
    ("Iced Tea", "drink", 449),
    ("Sparkling Water", "drink", 399),
    ("Craft Soda", "drink", 549),
    ("Espresso", "drink", 399),
    ("Latte", "drink", 599),
    ("Mocktail Citrus", "drink", 899),
    ("Virgin Mojito", "drink", 899),
    ("Hot Chocolate", "drink", 599),
    ("Fresh Juice", "drink", 699),
    ("Chocolate Cake", "dessert", 899),
    ("Cheesecake", "dessert", 999),
    ("Tiramisu", "dessert", 999),
    ("Apple Pie", "dessert", 899),
    ("Crème Brûlée", "dessert", 1099),
    ("Ice Cream Trio", "dessert", 799),
    ("Chef Special Bowl", "special", 2699),
    ("Seasonal Risotto", "special", 2499),
    ("Prime Rib Plate", "special", 3899),
    ("Seafood Linguine", "special", 3199),
)


def _nfc(value: str) -> str:
    return unicodedata.normalize("NFC", value)


def generate_menu(config: GeneratorConfig, _bundle: object | None = None) -> tuple[MenuItem, ...]:
    """Generate deterministic menu items referenced by orders.

    Menu prices are not the financial source of truth for order subtotals yet.
    They exist to make the Prisma seed realistic and to prevent foreign-key
    orphan records.
    """
    return tuple(
        MenuItem(
            id=menu_item_id(config.tenant_id, index),
            name=_nfc(name),
            category=_nfc(category),
            base_price_cents=money_cents(price_cents),
            active=True,
        )
        for index, (name, category, price_cents) in enumerate(_MENU_ITEMS)
    )
