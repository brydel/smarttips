from __future__ import annotations

import json
import unicodedata
from datetime import date, datetime
from functools import lru_cache
from typing import Final, Literal, TypeAlias
from uuid import UUID, uuid5

# Entity type tags: stable canonical names used to derive a per-entity
# namespace from the tenant id. Renaming any tag changes every downstream id.
EMPLOYEE: Final = "employee"
SHIFT: Final = "shift"
ORDER: Final = "order"
MENU_ITEM: Final = "menu_item"
ASSIGNMENT: Final = "assignment"

EntityType: TypeAlias = Literal[
    "employee",
    "shift",
    "order",
    "menu_item",
    "assignment",
]

_ALLOWED_ENTITY_TYPES: Final[frozenset[str]] = frozenset(
    {
        EMPLOYEE,
        SHIFT,
        ORDER,
        MENU_ITEM,
        ASSIGNMENT,
    }
)

_MAX_SEED: Final = 2**32 - 1


def _canonical_part(part: object) -> tuple[str, str]:
    """Return a type-tagged canonical representation for uuid5 names.

    The output is intentionally type-tagged so values like 1, "1", and UUID(...)
    cannot collide after serialization.
    """
    if isinstance(part, bool):
        # bool is a subclass of int; accepting it would make True dangerously
        # close to 1 semantically even if we type-tagged it.
        raise TypeError("error.ids.part.bool_unsupported")

    if isinstance(part, str):
        text = unicodedata.normalize("NFC", part)

        if not text:
            raise ValueError("error.ids.part.empty_string")

        return ("s", text)

    if isinstance(part, int):
        return ("i", str(part))

    if isinstance(part, UUID):
        return ("u", str(part))

    if isinstance(part, datetime):
        # datetime is a subclass of date. Reject it explicitly to prevent
        # accidental timezone/time precision from becoming part of deterministic
        # IDs. Domain wrappers should pass pure date values.
        raise TypeError("error.ids.part.datetime_unsupported")

    if isinstance(part, date):
        return ("d", part.isoformat())

    raise TypeError("error.ids.part.unsupported_type")


def _encode_parts(parts: tuple[object, ...]) -> str:
    if not parts:
        raise ValueError("error.ids.parts.empty")

    tagged = [_canonical_part(part) for part in parts]

    # Type-tagged JSON with tight separators is unambiguous across machines and
    # immune to framing collisions such as ("12:3") vs ("12", "3").
    return json.dumps(tagged, ensure_ascii=False, separators=(",", ":"))


def _validate_seed(seed: int) -> None:
    if isinstance(seed, bool):
        raise TypeError("error.ids.seed.bool_unsupported")

    if seed < 0 or seed > _MAX_SEED:
        raise ValueError("error.ids.seed.out_of_range")


def _validate_index(name: str, value: int) -> None:
    if isinstance(value, bool):
        raise TypeError(f"error.ids.{name}.bool_unsupported")

    if value < 0:
        raise ValueError(f"error.ids.{name}.negative")


def _validate_entity_type(entity_type: str) -> EntityType:
    if entity_type not in _ALLOWED_ENTITY_TYPES:
        raise ValueError("error.ids.entity_type.unsupported")

    return entity_type  # type: ignore[return-value]


def make_tenant_id(namespace: UUID, seed: int) -> UUID:
    _validate_seed(seed)
    return uuid5(namespace, _encode_parts((seed,)))


@lru_cache(maxsize=256)
def make_entity_namespace(tenant_id: UUID, entity_type: EntityType) -> UUID:
    # Pure + tiny key space per tenant; cache avoids re-deriving the same
    # namespace thousands of times during order generation.
    validated_entity_type = _validate_entity_type(entity_type)
    return uuid5(tenant_id, _encode_parts((validated_entity_type,)))


def make_entity_id(entity_namespace: UUID, *parts: object) -> UUID:
    return uuid5(entity_namespace, _encode_parts(parts))


# --- Thin domain wrappers: keep _ids generic, expose readable call sites. ---


def employee_id(tenant_id: UUID, employee_index: int) -> UUID:
    _validate_index("employee_index", employee_index)
    return make_entity_id(
        make_entity_namespace(tenant_id, EMPLOYEE),
        employee_index,
    )


def menu_item_id(tenant_id: UUID, menu_index: int) -> UUID:
    _validate_index("menu_index", menu_index)
    return make_entity_id(
        make_entity_namespace(tenant_id, MENU_ITEM),
        menu_index,
    )


def shift_id(tenant_id: UUID, shift_date: date, shift_type: str) -> UUID:
    return make_entity_id(
        make_entity_namespace(tenant_id, SHIFT),
        shift_date,
        shift_type,
    )


def order_id(tenant_id: UUID, shift: UUID, order_index: int) -> UUID:
    _validate_index("order_index", order_index)
    return make_entity_id(
        make_entity_namespace(tenant_id, ORDER),
        shift,
        order_index,
    )


def assignment_id(tenant_id: UUID, shift: UUID, employee: UUID) -> UUID:
    return make_entity_id(
        make_entity_namespace(tenant_id, ASSIGNMENT),
        shift,
        employee,
    )