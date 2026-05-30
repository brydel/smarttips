import os
from datetime import date
from pathlib import Path
from typing import Any
from uuid import UUID

import pytest
from generator._ids import make_tenant_id
from generator.config import GeneratorConfig
from pydantic import ValidationError

DEFAULT_NAMESPACE = UUID("00000000-0000-0000-0000-000000000001")


def build_config(**values: Any) -> GeneratorConfig:
    return GeneratorConfig(**values)


@pytest.fixture(autouse=True)
def isolated_settings_environment(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """Keep settings tests independent from a developer shell or local dotenv file."""
    for key in list(os.environ):
        if key.upper().startswith("GENERATOR_"):
            monkeypatch.delenv(key, raising=False)

    monkeypatch.chdir(tmp_path)


def test_defaults_are_reproducible_and_computed_from_seed() -> None:
    config = GeneratorConfig(seed=42)

    assert config.seed == 42
    assert config.start_date == date(2026, 1, 1)
    assert config.days == 90
    assert config.end_date == date(2026, 3, 31)
    assert config.employee_count == 12
    assert config.scenario == "steady"
    assert config.locale == "en_CA"
    assert config.output_dir == Path("data/synthetic")
    assert config.tenant_namespace == DEFAULT_NAMESPACE
    assert config.tenant_id == make_tenant_id(DEFAULT_NAMESPACE, 42)


def test_tenant_id_is_stable_for_same_seed_and_changes_for_different_seed() -> None:
    first = GeneratorConfig(seed=123)
    second = GeneratorConfig(seed=123)
    different_seed = GeneratorConfig(seed=124)

    assert first.tenant_id == second.tenant_id
    assert first.tenant_id != different_seed.tenant_id


def test_custom_namespace_participates_in_tenant_id_derivation() -> None:
    namespace = UUID("11111111-1111-1111-1111-111111111111")
    config = GeneratorConfig(seed=123, tenant_namespace=namespace)

    assert config.tenant_id == make_tenant_id(namespace, 123)
    assert config.tenant_id != make_tenant_id(DEFAULT_NAMESPACE, 123)


def test_end_date_is_inclusive_of_start_date() -> None:
    config = GeneratorConfig(seed=1, start_date=date(2026, 5, 10), days=7)

    assert config.end_date == date(2026, 5, 16)


def test_one_day_period_can_start_on_max_supported_date() -> None:
    config = GeneratorConfig(seed=1, start_date=date.max, days=1)

    assert config.end_date == date.max


def test_period_overflow_is_rejected_before_end_date_is_computed() -> None:
    with pytest.raises(ValidationError) as exc_info:
        GeneratorConfig(seed=1, start_date=date.max, days=2)

    errors = exc_info.value.errors()
    assert errors[0]["type"] == "value_error"
    assert "error.config.period.overflow" in str(errors[0]["msg"])


def test_output_dir_expands_user_home(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    home = tmp_path / "home"
    monkeypatch.setenv("HOME", str(home))

    config = GeneratorConfig(seed=1, output_dir=Path("~/exports"))

    assert config.output_dir == home / "exports"


def test_config_can_be_loaded_from_generator_environment(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    namespace = UUID("22222222-2222-2222-2222-222222222222")
    output_dir = tmp_path / "synthetic-output"
    monkeypatch.setenv("GENERATOR_SEED", "77")
    monkeypatch.setenv("GENERATOR_START_DATE", "2026-04-05")
    monkeypatch.setenv("GENERATOR_DAYS", "10")
    monkeypatch.setenv("GENERATOR_EMPLOYEE_COUNT", "18")
    monkeypatch.setenv("GENERATOR_SCENARIO", "seasonal")
    monkeypatch.setenv("GENERATOR_LOCALE", "fr_CA")
    monkeypatch.setenv("GENERATOR_OUTPUT_DIR", str(output_dir))
    monkeypatch.setenv("GENERATOR_TENANT_NAMESPACE", str(namespace))

    config = build_config()

    assert config.seed == 77
    assert config.start_date == date(2026, 4, 5)
    assert config.days == 10
    assert config.end_date == date(2026, 4, 14)
    assert config.employee_count == 18
    assert config.scenario == "seasonal"
    assert config.locale == "fr_CA"
    assert config.output_dir == output_dir
    assert config.tenant_namespace == namespace
    assert config.tenant_id == make_tenant_id(namespace, 77)


def test_env_prefix_is_case_insensitive(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("generator_seed", "88")

    assert build_config().seed == 88


def test_seed_is_required_when_environment_does_not_provide_it() -> None:
    with pytest.raises(ValidationError) as exc_info:
        build_config()

    assert exc_info.value.errors()[0]["loc"] == ("seed",)
    assert exc_info.value.errors()[0]["type"] == "missing"


@pytest.mark.parametrize(
    ("field", "value", "error_type"),
    [
        ("seed", -1, "greater_than_equal"),
        ("seed", 2**32, "less_than_equal"),
        ("days", 0, "greater_than_equal"),
        ("days", 366, "less_than_equal"),
        ("employee_count", 0, "greater_than_equal"),
        ("employee_count", 51, "less_than_equal"),
        ("scenario", "holiday", "literal_error"),
        ("locale", "en_US", "literal_error"),
    ],
)
def test_invalid_values_are_rejected(field: str, value: object, error_type: str) -> None:
    values = {field: value}
    if field != "seed":
        values["seed"] = 1

    with pytest.raises(ValidationError) as exc_info:
        build_config(**values)

    errors = exc_info.value.errors()
    assert errors[0]["loc"] == (field,)
    assert errors[0]["type"] == error_type


def test_extra_settings_are_forbidden() -> None:
    with pytest.raises(ValidationError) as exc_info:
        build_config(seed=1, raw_distribution_parameters={"tips": "mutable"})

    errors = exc_info.value.errors()
    assert errors[0]["loc"] == ("raw_distribution_parameters",)
    assert errors[0]["type"] == "extra_forbidden"


def test_config_is_frozen_after_creation() -> None:
    config = GeneratorConfig(seed=1)

    with pytest.raises(ValidationError) as exc_info:
        config.days = 30

    errors = exc_info.value.errors()
    assert errors[0]["loc"] == ("days",)
    assert errors[0]["type"] == "frozen_instance"
