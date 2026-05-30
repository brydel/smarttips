from __future__ import annotations

import math
from collections.abc import Sequence


def allocate_cents(total_cents: int, weights: Sequence[float]) -> tuple[int, ...]:
    """Allocate integer cents proportionally while preserving the exact total.

    Uses the largest-remainder/Hamilton method.

    Guarantees:
    - len(result) == len(weights)
    - all(result_i >= 0)
    - sum(result) == total_cents
    - deterministic ties: larger fractional remainder first, then lower index
    """
    if isinstance(total_cents, bool):
        raise TypeError("error.alloc.total.bool_unsupported")
    if not isinstance(total_cents, int):
        raise TypeError("error.alloc.total.not_int")
    if total_cents < 0:
        raise ValueError("error.alloc.total.negative")

    if len(weights) == 0:
        raise ValueError("error.alloc.weights.empty")

    clean_weights: list[float] = []

    for weight in weights:
        if isinstance(weight, bool):
            raise TypeError("error.alloc.weight.bool_unsupported")
        if not isinstance(weight, int | float):
            raise TypeError("error.alloc.weight.not_number")

        value = float(weight)

        if not math.isfinite(value):
            raise ValueError("error.alloc.weight.not_finite")
        if value < 0.0:
            raise ValueError("error.alloc.weight.negative")

        clean_weights.append(value)

    bucket_count = len(clean_weights)
    total_weight = math.fsum(clean_weights)

    if total_weight == 0.0:
        base, extra = divmod(total_cents, bucket_count)
        return tuple(base + (1 if index < extra else 0) for index in range(bucket_count))

    raw_shares = [
        total_cents * (weight / total_weight)
        for weight in clean_weights
    ]

    floors = [math.floor(raw_share) for raw_share in raw_shares]
    leftover = total_cents - sum(floors)

    order = sorted(
        range(bucket_count),
        key=lambda index: (-(raw_shares[index] - floors[index]), index),
    )

    result = floors[:]

    for index in order[:leftover]:
        result[index] += 1

    return tuple(result)