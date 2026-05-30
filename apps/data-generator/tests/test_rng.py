import re
from collections.abc import Callable
from typing import Any, cast

import pytest
from generator import rng


def error_match(message: str) -> str:
    return re.escape(message)


def sample_domain_stream(seed: int, domain: int) -> list[float]:
    return cast("list[float]", rng.domain_stream(seed, domain).random(5).tolist())


def sample_indexed_stream(seed: int, domain: int, index: int) -> list[float]:
    return cast("list[float]", rng.indexed_stream(seed, domain, index).random(5).tolist())


def test_domain_stream_is_deterministic_for_same_seed_and_domain() -> None:
    assert sample_domain_stream(42, rng.EMPLOYEES) == sample_domain_stream(42, rng.EMPLOYEES)


@pytest.mark.parametrize(
    ("left", "right"),
    [
        ((42, rng.EMPLOYEES, 0), (43, rng.EMPLOYEES, 0)),
        ((42, rng.EMPLOYEES, 0), (42, rng.SHIFTS, 0)),
        ((42, rng.EMPLOYEES, 0), (42, rng.EMPLOYEES, 1)),
    ],
)
def test_seed_domain_and_index_select_independent_streams(
    left: tuple[int, int, int],
    right: tuple[int, int, int],
) -> None:
    assert sample_indexed_stream(*left) != sample_indexed_stream(*right)


def test_domain_stream_and_indexed_stream_do_not_share_spawn_keys() -> None:
    assert sample_domain_stream(42, rng.EMPLOYEES) != sample_indexed_stream(42, rng.EMPLOYEES, 0)


def test_role_shuffle_stream_is_dedicated_and_deterministic() -> None:
    first = cast("list[float]", rng.role_shuffle_stream(42).random(5).tolist())
    second = cast("list[float]", rng.role_shuffle_stream(42).random(5).tolist())

    assert first == second
    assert first != sample_domain_stream(42, rng.EMPLOYEES)


def test_shift_sales_stream_is_dedicated_and_deterministic() -> None:
    first = cast("list[float]", rng.shift_sales_stream(42, 3).random(5).tolist())
    second = cast("list[float]", rng.shift_sales_stream(42, 3).random(5).tolist())

    assert first == second
    assert first != sample_indexed_stream(42, rng.SHIFTS, 3)


def test_shift_attendance_stream_is_dedicated_per_shift_employee_pair() -> None:
    first = cast("list[float]", rng.shift_attendance_stream(42, 3, 7).random(5).tolist())
    second = cast("list[float]", rng.shift_attendance_stream(42, 3, 7).random(5).tolist())

    assert first == second
    assert first != cast("list[float]", rng.shift_attendance_stream(42, 3, 8).random(5).tolist())
    assert first != cast("list[float]", rng.shift_attendance_stream(42, 4, 7).random(5).tolist())
    assert first != cast("list[float]", rng.shift_sales_stream(42, 3).random(5).tolist())


def test_tip_noise_stream_is_dedicated_per_shift_employee_pair() -> None:
    first = cast("list[float]", rng.tip_noise_stream(42, 3, 7).random(5).tolist())
    second = cast("list[float]", rng.tip_noise_stream(42, 3, 7).random(5).tolist())

    assert first == second
    assert first != cast("list[float]", rng.tip_noise_stream(42, 3, 8).random(5).tolist())
    assert first != cast("list[float]", rng.tip_noise_stream(42, 4, 7).random(5).tolist())
    assert first != sample_indexed_stream(42, rng.TIPS, 3)


@pytest.mark.parametrize(
    "stream_factory",
    [
        rng.order_subtotal_stream,
        rng.order_menu_stream,
        rng.order_server_stream,
        rng.order_tip_stream,
    ],
)
def test_order_streams_are_dedicated_and_deterministic(
    stream_factory: object,
) -> None:
    typed_factory = cast("Callable[[int, int], Any]", stream_factory)
    first_stream = typed_factory(42, 3)
    second_stream = typed_factory(42, 3)

    first = cast("list[float]", first_stream.random(5).tolist())
    second = cast("list[float]", second_stream.random(5).tolist())

    assert first == second
    assert first != sample_indexed_stream(42, rng.ORDERS, 3)


def test_faker_seed_is_deterministic_64_bit_int_and_independent_from_numpy_stream() -> None:
    seed = rng.faker_seed(42, rng.EMPLOYEES, 7)

    assert seed == rng.faker_seed(42, rng.EMPLOYEES, 7)
    assert 0 <= seed <= 2**64 - 1
    assert seed != rng.faker_seed(42, rng.EMPLOYEES, 8)
    assert seed != rng.faker_seed(42, rng.SHIFTS, 7)
    assert sample_indexed_stream(42, rng.EMPLOYEES, 7) == sample_indexed_stream(
        42,
        rng.EMPLOYEES,
        7,
    )


def test_domain_codes_are_explicit_stable_integers() -> None:
    assert {
        "EMPLOYEES": rng.EMPLOYEES,
        "MENU": rng.MENU,
        "SHIFTS": rng.SHIFTS,
        "ORDERS": rng.ORDERS,
        "TIPS": rng.TIPS,
    } == {
        "EMPLOYEES": 10,
        "MENU": 20,
        "SHIFTS": 30,
        "ORDERS": 40,
        "TIPS": 50,
    }


@pytest.mark.parametrize(
    ("seed", "error_type", "message"),
    [
        (True, TypeError, "error.rng.seed.bool_unsupported"),
        ("42", TypeError, "error.rng.seed.not_int"),
        (-1, ValueError, "error.rng.seed.negative"),
        (2**32, ValueError, "error.rng.seed.out_of_range"),
    ],
)
def test_streams_reject_invalid_seeds(
    seed: object,
    error_type: type[Exception],
    message: str,
) -> None:
    with pytest.raises(error_type, match=error_match(message)):
        rng.domain_stream(seed, rng.EMPLOYEES)  # type: ignore[arg-type]


@pytest.mark.parametrize(
    ("domain", "error_type", "message"),
    [
        (False, TypeError, "error.rng.domain.bool_unsupported"),
        ("10", TypeError, "error.rng.domain.not_int"),
        (-1, ValueError, "error.rng.domain.negative"),
        (2**32, ValueError, "error.rng.domain.out_of_range"),
        (999, ValueError, "error.rng.domain.unsupported"),
    ],
)
def test_streams_reject_invalid_domains(
    domain: object,
    error_type: type[Exception],
    message: str,
) -> None:
    with pytest.raises(error_type, match=error_match(message)):
        rng.domain_stream(42, domain)  # type: ignore[arg-type]


@pytest.mark.parametrize(
    ("index", "error_type", "message"),
    [
        (False, TypeError, "error.rng.index.bool_unsupported"),
        ("1", TypeError, "error.rng.index.not_int"),
        (-1, ValueError, "error.rng.index.negative"),
        (2**32, ValueError, "error.rng.index.out_of_range"),
    ],
)
def test_indexed_stream_rejects_invalid_indices(
    index: object,
    error_type: type[Exception],
    message: str,
) -> None:
    with pytest.raises(error_type, match=error_match(message)):
        rng.indexed_stream(42, rng.EMPLOYEES, index)  # type: ignore[arg-type]


@pytest.mark.parametrize(
    ("shift_index", "error_type", "message"),
    [
        (False, TypeError, "error.rng.index.bool_unsupported"),
        ("1", TypeError, "error.rng.index.not_int"),
        (-1, ValueError, "error.rng.index.negative"),
        (2**32, ValueError, "error.rng.index.out_of_range"),
    ],
)
def test_shift_sales_stream_rejects_invalid_shift_indices(
    shift_index: object,
    error_type: type[Exception],
    message: str,
) -> None:
    with pytest.raises(error_type, match=error_match(message)):
        rng.shift_sales_stream(42, shift_index)  # type: ignore[arg-type]


@pytest.mark.parametrize(
    ("employee_index", "error_type", "message"),
    [
        (False, TypeError, "error.rng.employee_index.bool_unsupported"),
        ("1", TypeError, "error.rng.employee_index.not_int"),
        (-1, ValueError, "error.rng.employee_index.negative"),
        (2**32, ValueError, "error.rng.employee_index.out_of_range"),
    ],
)
def test_shift_attendance_stream_rejects_invalid_employee_indices(
    employee_index: object,
    error_type: type[Exception],
    message: str,
) -> None:
    with pytest.raises(error_type, match=error_match(message)):
        rng.shift_attendance_stream(42, 0, employee_index)  # type: ignore[arg-type]


@pytest.mark.parametrize(
    ("employee_index", "error_type", "message"),
    [
        (False, TypeError, "error.rng.employee_index.bool_unsupported"),
        ("1", TypeError, "error.rng.employee_index.not_int"),
        (-1, ValueError, "error.rng.employee_index.negative"),
        (2**32, ValueError, "error.rng.employee_index.out_of_range"),
    ],
)
def test_tip_noise_stream_rejects_invalid_employee_indices(
    employee_index: object,
    error_type: type[Exception],
    message: str,
) -> None:
    with pytest.raises(error_type, match=error_match(message)):
        rng.tip_noise_stream(42, 0, employee_index)  # type: ignore[arg-type]


@pytest.mark.parametrize(
    "stream_factory",
    [
        rng.order_subtotal_stream,
        rng.order_menu_stream,
        rng.order_server_stream,
        rng.order_tip_stream,
    ],
)
@pytest.mark.parametrize(
    ("shift_index", "error_type", "message"),
    [
        (False, TypeError, "error.rng.index.bool_unsupported"),
        ("1", TypeError, "error.rng.index.not_int"),
        (-1, ValueError, "error.rng.index.negative"),
        (2**32, ValueError, "error.rng.index.out_of_range"),
    ],
)
def test_order_streams_reject_invalid_shift_indices(
    stream_factory: object,
    shift_index: object,
    error_type: type[Exception],
    message: str,
) -> None:
    typed_factory = cast("Callable[[int, object], Any]", stream_factory)
    with pytest.raises(error_type, match=error_match(message)):
        typed_factory(42, shift_index)
