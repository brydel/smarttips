import math
import re
from dataclasses import FrozenInstanceError
from typing import Any

import pytest
from generator.domain import EmployeeRole, ShiftType
from generator.patterns import (
    Range,
    RoleTipWeights,
    SalesProfile,
    ScenarioBundle,
    SeasonalProfile,
    TalentProfile,
    TipProfile,
    bundle_for,
    effective_talent,
    is_weekend,
    seasonal_multiplier,
    shift_premium,
    weekend_premium,
)


def error_match(message: str) -> str:
    return re.escape(message)


def set_attribute(obj: object, field_name: str, value: object) -> None:
    setattr(obj, field_name, value)


def build_talent_profile(**overrides: Any) -> TalentProfile:
    values: dict[str, Any] = {
        "beta_alpha": 2.0,
        "beta_beta": 2.0,
        "talent_floor": 0.6,
        "talent_ceiling": 1.4,
        "learning_rate": Range(0.0, 0.005),
        "cap_ratio": Range(1.0, 1.1),
    }
    values.update(overrides)
    return TalentProfile(**values)


def build_sales_profile(**overrides: Any) -> SalesProfile:
    values: dict[str, Any] = {
        "lunch_orders_lambda": 90.0,
        "dinner_orders_lambda": 150.0,
        "bill_mu": 3.8,
        "bill_sigma": 0.5,
        "forecast_noise": 0.1,
    }
    values.update(overrides)
    return SalesProfile(**values)


def build_tip_profile(**overrides: Any) -> TipProfile:
    values: dict[str, Any] = {
        "rate_mu": 0.18,
        "rate_sigma": 0.04,
        "rate_floor": 0.05,
        "rate_ceiling": 0.4,
        "dinner_premium": 1.15,
        "weekend_premium": 1.1,
        "noise_sigma": 0.08,
        "base_role_weights": RoleTipWeights(
            server=0.45,
            bartender=0.35,
            busser=0.25,
            host=0.18,
            cook=0.15,
            chef=0.18,
        ),
        "sales_share_weight": 1.0,
    }
    values.update(overrides)
    return TipProfile(**values)


def build_seasonal_profile(**overrides: Any) -> SeasonalProfile:
    values: dict[str, Any] = {
        "amplitude": 0.2,
        "phase": 0.0,
    }
    values.update(overrides)
    return SeasonalProfile(**values)


def build_bundle(**overrides: Any) -> ScenarioBundle:
    values: dict[str, Any] = {
        "talent": build_talent_profile(),
        "sales": build_sales_profile(),
        "tips": build_tip_profile(),
        "seasonal": build_seasonal_profile(),
    }
    values.update(overrides)
    return ScenarioBundle(**values)


def test_range_is_closed_frozen_and_slotted() -> None:
    interval = Range(0.0, 1.0)

    assert interval.lo == 0.0
    assert interval.hi == 1.0

    with pytest.raises(FrozenInstanceError):
        set_attribute(interval, "lo", 0.2)

    with pytest.raises(TypeError):
        set_attribute(interval, "label", "learning-rate")


@pytest.mark.parametrize(
    ("lo", "hi", "error_type", "message"),
    [
        (True, 1.0, TypeError, "error.patterns.range.lo.bool_unsupported"),
        ("0", 1.0, TypeError, "error.patterns.range.lo.not_number"),
        (math.inf, 1.0, ValueError, "error.patterns.range.lo.not_finite"),
        (2.0, 1.0, ValueError, "error.patterns.range.inverted"),
    ],
)
def test_range_rejects_invalid_bounds(
    lo: object,
    hi: object,
    error_type: type[Exception],
    message: str,
) -> None:
    with pytest.raises(error_type, match=error_match(message)):
        Range(lo, hi)  # type: ignore[arg-type]


@pytest.mark.parametrize(
    ("field", "value", "error_type", "message"),
    [
        ("beta_alpha", True, TypeError, "error.patterns.beta_alpha.bool_unsupported"),
        ("beta_beta", "2", TypeError, "error.patterns.beta_beta.not_number"),
        ("talent_floor", 0.0, ValueError, "error.patterns.talent_floor.not_positive"),
        ("talent_ceiling", 0.6, ValueError, "error.patterns.talent.invalid_band"),
        ("learning_rate", Range(-0.01, 0.01), ValueError, "error.patterns.learning_rate.negative"),
        ("cap_ratio", Range(0.99, 1.1), ValueError, "error.patterns.cap_ratio.below_one"),
        ("cap_ratio", Range(1.0, 3.01), ValueError, "error.patterns.cap_ratio.too_high"),
    ],
)
def test_talent_profile_rejects_invalid_parameters(
    field: str,
    value: object,
    error_type: type[Exception],
    message: str,
) -> None:
    with pytest.raises(error_type, match=error_match(message)):
        build_talent_profile(**{field: value})


@pytest.mark.parametrize(
    ("field", "value", "error_type", "message"),
    [
        ("lunch_orders_lambda", 0.0, ValueError, "error.patterns.lunch_orders_lambda.not_positive"),
        (
            "dinner_orders_lambda",
            False,
            TypeError,
            "error.patterns.dinner_orders_lambda.bool_unsupported",
        ),
        ("bill_mu", math.nan, ValueError, "error.patterns.bill_mu.not_finite"),
        ("bill_sigma", -0.1, ValueError, "error.patterns.bill_sigma.not_positive"),
        ("forecast_noise", -0.01, ValueError, "error.patterns.forecast_noise.negative"),
    ],
)
def test_sales_profile_rejects_invalid_parameters(
    field: str,
    value: object,
    error_type: type[Exception],
    message: str,
) -> None:
    with pytest.raises(error_type, match=error_match(message)):
        build_sales_profile(**{field: value})


@pytest.mark.parametrize(
    ("field", "value", "error_type", "message"),
    [
        ("rate_mu", 0.0, ValueError, "error.patterns.rate_mu.not_positive"),
        ("rate_sigma", True, TypeError, "error.patterns.rate_sigma.bool_unsupported"),
        ("rate_floor", 0.4, ValueError, "error.patterns.rate.invalid_band"),
        ("rate_mu", 0.41, ValueError, "error.patterns.rate_mu.out_of_band"),
        ("dinner_premium", 0.0, ValueError, "error.patterns.dinner_premium.not_positive"),
        ("weekend_premium", math.inf, ValueError, "error.patterns.weekend_premium.not_finite"),
        ("noise_sigma", -0.01, ValueError, "error.patterns.noise_sigma.negative"),
        ("sales_share_weight", -0.01, ValueError, "error.patterns.sales_share_weight.negative"),
    ],
)
def test_tip_profile_rejects_invalid_parameters(
    field: str,
    value: object,
    error_type: type[Exception],
    message: str,
) -> None:
    with pytest.raises(error_type, match=error_match(message)):
        build_tip_profile(**{field: value})


def test_role_tip_weights_return_expected_weight_for_each_role() -> None:
    weights = RoleTipWeights(
        server=0.45,
        bartender=0.35,
        busser=0.25,
        host=0.18,
        cook=0.15,
        chef=0.18,
    )

    assert weights.for_role(EmployeeRole.SERVER) == 0.45
    assert weights.for_role(EmployeeRole.BARTENDER) == 0.35
    assert weights.for_role(EmployeeRole.BUSSER) == 0.25
    assert weights.for_role(EmployeeRole.HOST) == 0.18
    assert weights.for_role(EmployeeRole.COOK) == 0.15
    assert weights.for_role(EmployeeRole.CHEF) == 0.18


@pytest.mark.parametrize(
    ("field", "value", "message"),
    [
        ("server", -0.01, "error.patterns.role_tip_weight.server.negative"),
        ("bartender", math.inf, "error.patterns.role_tip_weight.bartender.not_finite"),
        ("busser", True, "error.patterns.role_tip_weight.busser.bool_unsupported"),
    ],
)
def test_role_tip_weights_reject_invalid_weights(
    field: str,
    value: object,
    message: str,
) -> None:
    values: dict[str, object] = {
        "server": 0.45,
        "bartender": 0.35,
        "busser": 0.25,
        "host": 0.18,
        "cook": 0.15,
        "chef": 0.18,
    }
    values[field] = value

    with pytest.raises((TypeError, ValueError), match=error_match(message)):
        RoleTipWeights(**values)  # type: ignore[arg-type]


@pytest.mark.parametrize(
    ("field", "value", "error_type", "message"),
    [
        ("amplitude", False, TypeError, "error.patterns.season.amplitude.bool_unsupported"),
        ("amplitude", -0.01, ValueError, "error.patterns.season.amplitude.negative"),
        ("amplitude", 1.0, ValueError, "error.patterns.season.amplitude_too_high"),
        ("phase", math.nan, ValueError, "error.patterns.season.phase.not_finite"),
        ("phase", -0.01, ValueError, "error.patterns.season.phase_out_of_range"),
        ("phase", 1.0, ValueError, "error.patterns.season.phase_out_of_range"),
    ],
)
def test_seasonal_profile_rejects_invalid_parameters(
    field: str,
    value: object,
    error_type: type[Exception],
    message: str,
) -> None:
    with pytest.raises(error_type, match=error_match(message)):
        build_seasonal_profile(**{field: value})


def test_bundle_for_returns_code_pinned_singleton_bundles() -> None:
    steady = bundle_for("steady")
    growth = bundle_for("growth")
    seasonal = bundle_for("seasonal")

    assert bundle_for("steady") is steady
    assert growth is not steady
    assert seasonal is not steady
    assert steady.seasonal.amplitude == 0.0
    assert growth.talent.learning_rate.lo > steady.talent.learning_rate.lo
    assert seasonal.seasonal.amplitude > steady.seasonal.amplitude


def test_bundle_for_rejects_unknown_scenario() -> None:
    unknown_scenario: Any = "holiday"

    with pytest.raises(ValueError, match=error_match("error.patterns.scenario.unknown")):
        bundle_for(unknown_scenario)


def test_scenario_bundles_are_frozen_deep_enough_for_presets() -> None:
    bundle = bundle_for("steady")

    with pytest.raises(FrozenInstanceError):
        set_attribute(bundle, "sales", build_sales_profile())

    with pytest.raises(FrozenInstanceError):
        set_attribute(bundle.tips, "rate_mu", 0.2)


def test_effective_talent_starts_at_base_and_converges_toward_cap() -> None:
    base = 0.8
    cap = 1.2

    at_start = effective_talent(base, learning_rate=0.05, talent_cap=cap, shifts_worked=0)
    after_one = effective_talent(base, learning_rate=0.05, talent_cap=cap, shifts_worked=1)
    after_many = effective_talent(base, learning_rate=0.05, talent_cap=cap, shifts_worked=1_000)

    assert at_start == pytest.approx(base)
    assert base < after_one < after_many <= cap
    assert after_many == pytest.approx(cap)


@pytest.mark.parametrize(
    ("kwargs", "error_type", "message"),
    [
        ({"talent_base": True}, TypeError, "error.patterns.talent_base.bool_unsupported"),
        ({"learning_rate": -0.01}, ValueError, "error.patterns.learning_rate.negative"),
        ({"talent_cap": 0.7}, ValueError, "error.patterns.talent_cap.below_base"),
        ({"shifts_worked": False}, TypeError, "error.patterns.shifts_worked.bool_unsupported"),
        ({"shifts_worked": 1.5}, TypeError, "error.patterns.shifts_worked.not_int"),
        ({"shifts_worked": -1}, ValueError, "error.patterns.shifts_worked.negative"),
    ],
)
def test_effective_talent_rejects_invalid_inputs(
    kwargs: dict[str, object],
    error_type: type[Exception],
    message: str,
) -> None:
    values: dict[str, object] = {
        "talent_base": 0.8,
        "learning_rate": 0.05,
        "talent_cap": 1.2,
        "shifts_worked": 5,
    }
    values.update(kwargs)

    with pytest.raises(error_type, match=error_match(message)):
        effective_talent(**values)  # type: ignore[arg-type]


def test_seasonal_multiplier_is_bounded_by_amplitude_and_phase() -> None:
    profile = SeasonalProfile(amplitude=0.2, phase=0.25)

    assert seasonal_multiplier(profile, 0.0) == pytest.approx(1.2)
    assert seasonal_multiplier(profile, 0.25) == pytest.approx(1.0)
    assert seasonal_multiplier(profile, 0.5) == pytest.approx(0.8)


@pytest.mark.parametrize(
    ("year_progress", "error_type", "message"),
    [
        (True, TypeError, "error.patterns.year_progress.bool_unsupported"),
        ("0.5", TypeError, "error.patterns.year_progress.not_number"),
        (math.inf, ValueError, "error.patterns.year_progress.not_finite"),
        (-0.01, ValueError, "error.patterns.year_progress.out_of_range"),
        (1.0, ValueError, "error.patterns.year_progress.out_of_range"),
    ],
)
def test_seasonal_multiplier_rejects_invalid_year_progress(
    year_progress: object,
    error_type: type[Exception],
    message: str,
) -> None:
    with pytest.raises(error_type, match=error_match(message)):
        seasonal_multiplier(SeasonalProfile(amplitude=0.2, phase=0.0), year_progress)  # type: ignore[arg-type]


@pytest.mark.parametrize(
    ("day_of_week", "expected"),
    [
        (0, False),
        (4, False),
        (5, True),
        (6, True),
    ],
)
def test_is_weekend_matches_python_weekday_convention(day_of_week: int, expected: bool) -> None:
    assert is_weekend(day_of_week) is expected


@pytest.mark.parametrize(
    ("day_of_week", "error_type", "message"),
    [
        (True, TypeError, "error.patterns.day_of_week.bool_unsupported"),
        ("5", TypeError, "error.patterns.day_of_week.not_int"),
        (-1, ValueError, "error.patterns.day_of_week.out_of_range"),
        (7, ValueError, "error.patterns.day_of_week.out_of_range"),
    ],
)
def test_is_weekend_rejects_invalid_day_of_week(
    day_of_week: object,
    error_type: type[Exception],
    message: str,
) -> None:
    with pytest.raises(error_type, match=error_match(message)):
        is_weekend(day_of_week)  # type: ignore[arg-type]


def test_shift_and_weekend_premiums_use_bundle_tip_parameters() -> None:
    bundle = build_bundle(tips=build_tip_profile(dinner_premium=1.25, weekend_premium=1.15))

    assert shift_premium(bundle, ShiftType.LUNCH) == 1.0
    assert shift_premium(bundle, ShiftType.DINNER) == 1.25
    assert weekend_premium(bundle, 4) == 1.0
    assert weekend_premium(bundle, 5) == 1.15
    assert weekend_premium(bundle, 6) == 1.15


def test_shift_premium_rejects_unsupported_shift_type() -> None:
    unsupported_shift_type: Any = "DINNER"

    with pytest.raises(ValueError, match=error_match("error.patterns.shift_type.unsupported")):
        shift_premium(build_bundle(), unsupported_shift_type)
