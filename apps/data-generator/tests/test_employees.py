import re
from collections import Counter
from datetime import date, timedelta

import numpy as np
import pytest
from generator._ids import employee_id
from generator.config import GeneratorConfig
from generator.domain import EmployeeRole
from generator.employees import (
    _MAX_TENURE_DAYS,
    _employee_email,
    _rescale_beta,
    _role_sequence,
    _sample_range,
    _slugify_email_part,
    generate_employees,
)
from generator.patterns import Range, bundle_for


def error_match(message: str) -> str:
    return re.escape(message)


def config_for(seed: int = 42, employee_count: int = 12) -> GeneratorConfig:
    return GeneratorConfig(
        seed=seed,
        start_date=date(2026, 5, 1),
        employee_count=employee_count,
    )


def test_generate_employees_is_deterministic_for_same_config_and_bundle() -> None:
    config = config_for(seed=123, employee_count=12)
    bundle = bundle_for("steady")

    assert generate_employees(config, bundle) == generate_employees(config, bundle)


def test_generate_employees_changes_when_seed_changes() -> None:
    bundle = bundle_for("steady")
    employees, profiles = generate_employees(config_for(seed=123), bundle)
    other_employees, other_profiles = generate_employees(config_for(seed=124), bundle)

    assert employees != other_employees
    assert profiles != other_profiles


def test_generate_employees_returns_expected_public_and_latent_records() -> None:
    config = config_for(seed=123, employee_count=12)
    bundle = bundle_for("steady")
    employees, profiles = generate_employees(config, bundle)

    assert len(employees) == config.employee_count
    assert len(profiles) == config.employee_count

    expected_ids = tuple(
        employee_id(config.tenant_id, index)
        for index in range(config.employee_count)
    )
    assert tuple(employee.id for employee in employees) == expected_ids
    assert tuple(profile.employee_id for profile in profiles) == expected_ids

    assert len({employee.email for employee in employees}) == config.employee_count
    assert len({employee.id for employee in employees}) == config.employee_count

    for index, employee in enumerate(employees):
        assert employee.first_name.strip()
        assert employee.last_name.strip()
        assert employee.email == _employee_email(employee.first_name, employee.last_name, index)
        assert employee.email.endswith("@example.test")
        assert re.fullmatch(r"[a-z0-9.]+@example\.test", employee.email)
        assert config.start_date - timedelta(days=_MAX_TENURE_DAYS) <= employee.hired_at
        assert employee.hired_at <= config.start_date

    talent = bundle.talent
    for profile in profiles:
        assert talent.talent_floor <= profile.talent_base <= talent.talent_ceiling
        assert profile.talent_base * talent.cap_ratio.lo <= profile.talent_cap
        assert profile.talent_cap <= profile.talent_base * talent.cap_ratio.hi
        assert talent.learning_rate.lo <= profile.learning_rate <= talent.learning_rate.hi
        assert 0.80 <= profile.reliability <= 1.0


def test_generated_role_counts_follow_largest_remainder_mix() -> None:
    employees, _ = generate_employees(config_for(seed=123, employee_count=12), bundle_for("steady"))

    assert Counter(employee.role for employee in employees) == {
        EmployeeRole.SERVER: 5,
        EmployeeRole.BARTENDER: 2,
        EmployeeRole.BUSSER: 2,
        EmployeeRole.HOST: 1,
        EmployeeRole.COOK: 1,
        EmployeeRole.CHEF: 1,
    }


def test_role_sequence_is_deterministic_but_seeded() -> None:
    assert _role_sequence(12, 123) == _role_sequence(12, 123)
    assert _role_sequence(12, 123) != _role_sequence(12, 124)


def test_role_sequence_preserves_requested_size_for_small_teams() -> None:
    roles = _role_sequence(3, 123)

    assert len(roles) == 3
    assert all(isinstance(role, EmployeeRole) for role in roles)


def test_slugify_email_part_normalizes_accents_and_punctuation() -> None:
    assert _slugify_email_part("Élodie O'Neil") == "elodie.o.neil"
    assert _slugify_email_part("  Jean-Luc  ") == "jean.luc"
    assert _slugify_email_part("!!!") == "employee"


def test_employee_email_is_lowercase_unique_and_example_scoped() -> None:
    assert _employee_email("Élodie", "O'Neil", 7) == "elodie.o.neil.7@example.test"


def test_rescale_beta_maps_unit_interval_to_requested_range() -> None:
    assert _rescale_beta(0.0, 0.6, 1.4) == pytest.approx(0.6)
    assert _rescale_beta(0.5, 0.6, 1.4) == pytest.approx(1.0)
    assert _rescale_beta(1.0, 0.6, 1.4) == pytest.approx(1.4)


@pytest.mark.parametrize(
    ("unit", "message"),
    [
        (np.nan, "error.employees.beta_unit.not_finite"),
        (np.inf, "error.employees.beta_unit.not_finite"),
        (-0.01, "error.employees.beta_unit.out_of_range"),
        (1.01, "error.employees.beta_unit.out_of_range"),
    ],
)
def test_rescale_beta_rejects_invalid_unit_values(unit: float, message: str) -> None:
    with pytest.raises(ValueError, match=error_match(message)):
        _rescale_beta(unit, 0.6, 1.4)


def test_sample_range_returns_fixed_value_without_consuming_uniform_range() -> None:
    generator = np.random.default_rng(123)

    assert _sample_range(generator, Range(0.2, 0.2)) == 0.2


def test_sample_range_samples_within_interval() -> None:
    generator = np.random.default_rng(123)

    value = _sample_range(generator, Range(0.2, 0.4))

    assert 0.2 <= value <= 0.4
