import re
from datetime import date, datetime
from uuid import UUID

import pytest
from generator._ids import (
    EMPLOYEE,
    employee_id,
    make_entity_id,
    make_entity_namespace,
    make_tenant_id,
    order_id,
    shift_id,
)

NAMESPACE = UUID("00000000-0000-0000-0000-000000000001")


def error_match(message: str) -> str:
    return re.escape(message)


def test_tenant_id_is_deterministic() -> None:
    assert make_tenant_id(NAMESPACE, 42) == make_tenant_id(NAMESPACE, 42)


def test_different_seed_produces_different_tenant() -> None:
    assert make_tenant_id(NAMESPACE, 42) != make_tenant_id(NAMESPACE, 43)


def test_entity_id_is_deterministic() -> None:
    tenant_id = make_tenant_id(NAMESPACE, 42)
    namespace = make_entity_namespace(tenant_id, EMPLOYEE)

    assert make_entity_id(namespace, "a", 1) == make_entity_id(namespace, "a", 1)


def test_type_tags_prevent_string_int_collision() -> None:
    tenant_id = make_tenant_id(NAMESPACE, 42)
    namespace = make_entity_namespace(tenant_id, EMPLOYEE)

    assert make_entity_id(namespace, "1") != make_entity_id(namespace, 1)


def test_json_framing_prevents_separator_collision() -> None:
    tenant_id = make_tenant_id(NAMESPACE, 42)
    namespace = make_entity_namespace(tenant_id, EMPLOYEE)

    assert make_entity_id(namespace, "employee", "12:3") != make_entity_id(
        namespace,
        "employee:12",
        "3",
    )


def test_unicode_normalization_is_stable() -> None:
    tenant_id = make_tenant_id(NAMESPACE, 42)

    composed = "é"
    decomposed = "e\u0301"

    assert employee_id(tenant_id, 0) == employee_id(tenant_id, 0)
    assert make_entity_id(make_entity_namespace(tenant_id, EMPLOYEE), composed) == make_entity_id(
        make_entity_namespace(tenant_id, EMPLOYEE),
        decomposed,
    )


def test_rejects_bool_parts() -> None:
    tenant_id = make_tenant_id(NAMESPACE, 42)
    namespace = make_entity_namespace(tenant_id, EMPLOYEE)

    with pytest.raises(TypeError, match=error_match("error.ids.part.bool_unsupported")):
        make_entity_id(namespace, True)


def test_rejects_datetime_parts() -> None:
    tenant_id = make_tenant_id(NAMESPACE, 42)

    with pytest.raises(TypeError, match=error_match("error.ids.part.datetime_unsupported")):
        shift_id(tenant_id, datetime(2026, 1, 1, 12, 0), "DINNER")


def test_rejects_negative_employee_index() -> None:
    tenant_id = make_tenant_id(NAMESPACE, 42)

    with pytest.raises(ValueError, match=error_match("error.ids.employee_index.negative")):
        employee_id(tenant_id, -1)


def test_rejects_negative_order_index() -> None:
    tenant_id = make_tenant_id(NAMESPACE, 42)
    shift = shift_id(tenant_id, date(2026, 1, 1), "DINNER")

    with pytest.raises(ValueError, match=error_match("error.ids.order_index.negative")):
        order_id(tenant_id, shift, -1)


def test_rejects_seed_out_of_range() -> None:
    with pytest.raises(ValueError, match=error_match("error.ids.seed.out_of_range")):
        make_tenant_id(NAMESPACE, 2**32)


def test_rejects_unsupported_entity_type() -> None:
    tenant_id = make_tenant_id(NAMESPACE, 42)

    with pytest.raises(ValueError, match=error_match("error.ids.entity_type.unsupported")):
        make_entity_namespace(tenant_id, "employe")
