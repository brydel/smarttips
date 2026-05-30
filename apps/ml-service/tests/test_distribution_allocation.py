from __future__ import annotations

import re

import pytest
from app.models.distribution_allocation import allocate_cents


@pytest.mark.parametrize(
    ("pool_cents", "weights"),
    [
        (1, [3.0, 1.0, 1.0]),
        (2, [3.0, 1.0, 1.0]),
        (101, [3.0, 1.0, 1.0]),
        (10_003, [3.0, 1.0, 1.0]),
    ],
)
def test_allocate_cents_preserves_pool_exactly_for_unequal_weights(
    pool_cents: int,
    weights: list[float],
) -> None:
    allocations = allocate_cents(pool_cents, weights)

    assert len(allocations) == len(weights)
    assert sum(allocations) == pool_cents
    assert allocations[0] >= allocations[1]
    assert allocations[0] >= allocations[2]


def test_allocate_cents_returns_zero_allocations_for_zero_pool() -> None:
    allocations = allocate_cents(0, [3.0, 1.0, 1.0])

    assert allocations == (0, 0, 0)
    assert sum(allocations) == 0


def test_allocate_cents_falls_back_to_equal_split_when_total_weight_is_zero() -> None:
    allocations = allocate_cents(101, [0.0, 0.0, 0.0])

    assert allocations == (34, 34, 33)
    assert sum(allocations) == 101


def test_allocate_cents_largest_remainder_ties_are_deterministic_by_index() -> None:
    allocations = allocate_cents(100, [1.0, 1.0, 1.0])

    assert allocations == (34, 33, 33)
    assert sum(allocations) == 100


def test_allocate_cents_rejects_bool_total_before_int() -> None:
    with pytest.raises(
        TypeError,
        match=re.escape("error.distribution.alloc.total.bool_unsupported"),
    ):
        allocate_cents(True, [1.0])


def test_allocate_cents_rejects_non_finite_weight() -> None:
    with pytest.raises(
        ValueError,
        match=re.escape("error.distribution.alloc.weight.not_finite"),
    ):
        allocate_cents(100, [float("nan")])
