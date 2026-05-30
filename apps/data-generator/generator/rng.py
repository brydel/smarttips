from __future__ import annotations

from typing import Final

import numpy as np
from numpy.random import Generator, SeedSequence, default_rng

# Stable integer domain codes. Never use Python hash(): it is randomized per
# process and would silently break byte-for-byte reproducibility.
EMPLOYEES: Final = 10
MENU: Final = 20
SHIFTS: Final = 30
ORDERS: Final = 40
TIPS: Final = 50

_NUMPY_STREAM: Final = 0
_FAKER_STREAM: Final = 1
_ROLE_SHUFFLE_STREAM: Final = 2
_SHIFT_SALES_STREAM: Final = 3
_SHIFT_ATTENDANCE_STREAM: Final = 4
_TIP_POOL_STREAM: Final = 5
_TIP_NOISE_STREAM: Final = 6
_ORDER_SUBTOTAL_STREAM: Final = 7
_ORDER_MENU_STREAM: Final = 8
_ORDER_SERVER_STREAM: Final = 9
_ORDER_TIP_STREAM: Final = 10

_ALLOWED_DOMAINS: Final[frozenset[int]] = frozenset(
    {
        EMPLOYEES,
        MENU,
        SHIFTS,
        ORDERS,
        TIPS,
    }
)

_MAX_SEED: Final = 2**32 - 1
_MAX_SPAWN_KEY: Final = 2**32 - 1


def _validate_int(name: str, value: int) -> None:
    if isinstance(value, bool):
        raise TypeError(f"error.rng.{name}.bool_unsupported")
    if not isinstance(value, int):
        raise TypeError(f"error.rng.{name}.not_int")
    if value < 0:
        raise ValueError(f"error.rng.{name}.negative")
    if value > _MAX_SPAWN_KEY:
        raise ValueError(f"error.rng.{name}.out_of_range")


def _validate_seed(seed: int) -> None:
    _validate_int("seed", seed)
    if seed > _MAX_SEED:
        raise ValueError("error.rng.seed.out_of_range")


def _validate_domain(domain: int) -> None:
    _validate_int("domain", domain)
    if domain not in _ALLOWED_DOMAINS:
        raise ValueError("error.rng.domain.unsupported")


def _validate(seed: int, domain: int, index: int) -> None:
    _validate_seed(seed)
    _validate_domain(domain)
    _validate_int("index", index)


def domain_stream(seed: int, domain: int) -> Generator:
    """Return a per-domain Generator independent of call order across domains.

    Use this only for a single, well-defined domain-level operation.
    Prefer named stream helpers for reusable domain-wide operations.
    """
    _validate(seed, domain, 0)
    return default_rng(SeedSequence(seed, spawn_key=(domain, _NUMPY_STREAM)))


def indexed_stream(seed: int, domain: int, index: int) -> Generator:
    """Return a per-(domain, index) Generator.

    Entity index gets the same draws regardless of generation order, added
    columns in sibling entities, or other domains being generated first.
    """
    _validate(seed, domain, index)
    return default_rng(SeedSequence(seed, spawn_key=(domain, index, _NUMPY_STREAM)))


def role_shuffle_stream(seed: int) -> Generator:
    """Return the dedicated stream used only for workforce role shuffling.

    This intentionally does not reuse domain_stream(seed, EMPLOYEES), because
    domain-global streams become fragile as soon as another domain-level
    operation is added later.
    """
    _validate_seed(seed)
    return default_rng(SeedSequence(seed, spawn_key=(EMPLOYEES, _ROLE_SHUFFLE_STREAM)))


def shift_sales_stream(seed: int, shift_index: int) -> Generator:
    """Return the dedicated sales stream for one shift.

    Isolated from attendance so adding/removing sales draws cannot change
    which employees are present.
    """
    _validate(seed, SHIFTS, shift_index)

    return default_rng(
        SeedSequence(
            seed,
            spawn_key=(SHIFTS, shift_index, _SHIFT_SALES_STREAM),
        )
    )


def shift_attendance_stream(
    seed: int,
    shift_index: int,
    employee_index: int,
) -> Generator:
    """Return the dedicated attendance stream for one shift/employee pair.

    Presence for a given employee at a given shift is independent from the
    iteration order of other employees.
    """
    _validate(seed, SHIFTS, shift_index)
    _validate_int("employee_index", employee_index)

    return default_rng(
        SeedSequence(
            seed,
            spawn_key=(SHIFTS, shift_index, employee_index, _SHIFT_ATTENDANCE_STREAM),
        )
    )


def tip_noise_stream(seed: int, shift_index: int, employee_index: int) -> Generator:
    """Return the dedicated employee noise stream for tip allocation.

    This avoids order-coupling between employees in the same shift.
    """
    _validate(seed, TIPS, shift_index)
    _validate_int("employee_index", employee_index)

    return default_rng(
        SeedSequence(
            seed,
            spawn_key=(TIPS, shift_index, employee_index, _TIP_NOISE_STREAM),
        )
    )


def order_subtotal_stream(seed: int, shift_index: int) -> Generator:
    _validate(seed, ORDERS, shift_index)
    return default_rng(
        SeedSequence(seed, spawn_key=(ORDERS, shift_index, _ORDER_SUBTOTAL_STREAM))
    )


def order_menu_stream(seed: int, shift_index: int) -> Generator:
    _validate(seed, ORDERS, shift_index)
    return default_rng(
        SeedSequence(seed, spawn_key=(ORDERS, shift_index, _ORDER_MENU_STREAM))
    )


def order_server_stream(seed: int, shift_index: int) -> Generator:
    _validate(seed, ORDERS, shift_index)
    return default_rng(
        SeedSequence(seed, spawn_key=(ORDERS, shift_index, _ORDER_SERVER_STREAM))
    )


def order_tip_stream(seed: int, shift_index: int) -> Generator:
    _validate(seed, ORDERS, shift_index)
    return default_rng(
        SeedSequence(seed, spawn_key=(ORDERS, shift_index, _ORDER_TIP_STREAM))
    )


def faker_seed(seed: int, domain: int, index: int) -> int:
    """Return a stable 64-bit Faker seed from the SeedSequence tree.

    This intentionally does not consume the NumPy Generator used for employee
    latent features, so Faker names cannot shift beta/reliability draws.
    """
    _validate(seed, domain, index)

    sequence = SeedSequence(seed, spawn_key=(domain, index, _FAKER_STREAM))
    hi, lo = sequence.generate_state(2, dtype=np.uint32)

    return (int(hi) << 32) | int(lo)
