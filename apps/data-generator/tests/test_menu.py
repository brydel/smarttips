import unicodedata

from generator.config import GeneratorConfig
from generator.menu import generate_menu
from generator.patterns import bundle_for


def test_generate_menu_returns_deterministic_real_menu_items() -> None:
    config = GeneratorConfig(seed=42)
    bundle = bundle_for("steady")

    menu_items = generate_menu(config, bundle)

    assert menu_items == generate_menu(config, bundle)
    assert len(menu_items) == 40
    assert len({item.id for item in menu_items}) == 40
    assert all(item.name for item in menu_items)
    assert all(item.category for item in menu_items)
    assert all(item.name == unicodedata.normalize("NFC", item.name) for item in menu_items)
    assert all(item.category == unicodedata.normalize("NFC", item.category) for item in menu_items)
    assert all(item.base_price_cents > 0 for item in menu_items)
    assert all(item.active for item in menu_items)
