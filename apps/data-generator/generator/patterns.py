from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Final

from generator.config import Scenario
from generator.domain import EmployeeRole, ShiftType

# All generative ground truth lives here, code-pinned.
# Nothing in this file is env-overridable. GeneratorConfig.scenario only selects
# one frozen bundle below; it never injects raw distribution parameters.


def _require_finite_float(field_name: str, value: float) -> None:
    if isinstance(value, bool):
        raise TypeError(f"error.patterns.{field_name}.bool_unsupported")
    if not isinstance(value, int | float):
        raise TypeError(f"error.patterns.{field_name}.not_number")
    if not math.isfinite(float(value)):
        raise ValueError(f"error.patterns.{field_name}.not_finite")


def _require_positive_float(field_name: str, value: float) -> None:
    _require_finite_float(field_name, value)
    if value <= 0.0:
        raise ValueError(f"error.patterns.{field_name}.not_positive")


def _require_non_negative_float(field_name: str, value: float) -> None:
    _require_finite_float(field_name, value)
    if value < 0.0:
        raise ValueError(f"error.patterns.{field_name}.negative")


def _require_unit_interval_open(field_name: str, value: float) -> None:
    """Require value in [0.0, 1.0)."""
    _require_finite_float(field_name, value)

    if value < 0.0 or value >= 1.0:
        raise ValueError(f"error.patterns.{field_name}.out_of_range")


def _require_day_of_week(day_of_week: int) -> None:
    if isinstance(day_of_week, bool):
        raise TypeError("error.patterns.day_of_week.bool_unsupported")
    if not isinstance(day_of_week, int):
        raise TypeError("error.patterns.day_of_week.not_int")
    if day_of_week < 0 or day_of_week > 6:
        raise ValueError("error.patterns.day_of_week.out_of_range")


@dataclass(frozen=True, slots=True)
class Range:
    """Closed sampling interval [lo, hi].

    Sampling happens in entity generators with the seeded RNG.
    This module only declares immutable ground-truth bounds.
    """

    lo: float
    hi: float

    def __post_init__(self) -> None:
        _require_finite_float("range.lo", self.lo)
        _require_finite_float("range.hi", self.hi)

        if self.lo > self.hi:
            raise ValueError("error.patterns.range.inverted")


@dataclass(frozen=True, slots=True)
class TalentProfile:
    """Latent talent distribution and learning dynamics.

    Base talent is sampled from Beta(alpha, beta), then rescaled into
    [talent_floor, talent_ceiling].

    learning_rate and cap_ratio are latent generator parameters.
    They must never be exported to the ML dataset.
    """

    beta_alpha: float
    beta_beta: float
    talent_floor: float
    talent_ceiling: float
    learning_rate: Range
    cap_ratio: Range

    def __post_init__(self) -> None:
        _require_positive_float("beta_alpha", self.beta_alpha)
        _require_positive_float("beta_beta", self.beta_beta)
        _require_positive_float("talent_floor", self.talent_floor)
        _require_positive_float("talent_ceiling", self.talent_ceiling)

        if self.talent_ceiling <= self.talent_floor:
            raise ValueError("error.patterns.talent.invalid_band")

        if self.learning_rate.lo < 0.0:
            raise ValueError("error.patterns.learning_rate.negative")

        if self.cap_ratio.lo < 1.0:
            raise ValueError("error.patterns.cap_ratio.below_one")

        if self.cap_ratio.hi > 3.0:
            raise ValueError("error.patterns.cap_ratio.too_high")


@dataclass(frozen=True, slots=True)
class SalesProfile:
    """Sales and order-count distribution parameters."""

    lunch_orders_lambda: float
    dinner_orders_lambda: float
    bill_mu: float
    bill_sigma: float
    forecast_noise: float

    def __post_init__(self) -> None:
        _require_positive_float("lunch_orders_lambda", self.lunch_orders_lambda)
        _require_positive_float("dinner_orders_lambda", self.dinner_orders_lambda)
        _require_finite_float("bill_mu", self.bill_mu)
        _require_positive_float("bill_sigma", self.bill_sigma)
        _require_non_negative_float("forecast_noise", self.forecast_noise)


@dataclass(frozen=True, slots=True)
class RoleTipWeights:
    server: float
    bartender: float
    busser: float
    host: float
    cook: float
    chef: float

    def __post_init__(self) -> None:
        for name in ("server", "bartender", "busser", "host", "cook", "chef"):
            _require_non_negative_float(
                f"role_tip_weight.{name}",
                getattr(self, name),
            )

        for role in EmployeeRole:
            self.for_role(role)

    def for_role(self, role: EmployeeRole) -> float:
        match role:
            case EmployeeRole.SERVER:
                return self.server
            case EmployeeRole.BARTENDER:
                return self.bartender
            case EmployeeRole.BUSSER:
                return self.busser
            case EmployeeRole.HOST:
                return self.host
            case EmployeeRole.COOK:
                return self.cook
            case EmployeeRole.CHEF:
                return self.chef

        raise ValueError("error.patterns.role.unsupported")


@dataclass(frozen=True, slots=True)
class TipProfile:
    """Tip-rate and multiplier parameters.

    Tip rate is sampled from a normal distribution and clamped to
    [rate_floor, rate_ceiling].
    """

    rate_mu: float
    rate_sigma: float
    rate_floor: float
    rate_ceiling: float
    dinner_premium: float
    weekend_premium: float
    noise_sigma: float
    base_role_weights: RoleTipWeights
    sales_share_weight: float

    def __post_init__(self) -> None:
        _require_positive_float("rate_mu", self.rate_mu)
        _require_positive_float("rate_sigma", self.rate_sigma)
        _require_positive_float("rate_floor", self.rate_floor)
        _require_positive_float("rate_ceiling", self.rate_ceiling)
        _require_positive_float("dinner_premium", self.dinner_premium)
        _require_positive_float("weekend_premium", self.weekend_premium)
        _require_non_negative_float("noise_sigma", self.noise_sigma)
        _require_non_negative_float("sales_share_weight", self.sales_share_weight)

        if self.rate_floor >= self.rate_ceiling:
            raise ValueError("error.patterns.rate.invalid_band")

        if not (self.rate_floor <= self.rate_mu <= self.rate_ceiling):
            raise ValueError("error.patterns.rate_mu.out_of_band")


@dataclass(frozen=True, slots=True)
class SeasonalProfile:
    """Seasonal multiplier parameters.

    amplitude must stay below 1.0 so the multiplier can never become negative.
    phase is a normalized offset in [0.0, 1.0).
    """

    amplitude: float
    phase: float

    def __post_init__(self) -> None:
        _require_non_negative_float("season.amplitude", self.amplitude)
        _require_finite_float("season.phase", self.phase)

        if self.amplitude >= 1.0:
            raise ValueError("error.patterns.season.amplitude_too_high")

        if not (0.0 <= self.phase < 1.0):
            raise ValueError("error.patterns.season.phase_out_of_range")


@dataclass(frozen=True, slots=True)
class ScenarioBundle:
    talent: TalentProfile
    sales: SalesProfile
    tips: TipProfile
    seasonal: SeasonalProfile


# --- pure formulas: deterministic, no RNG, no I/O ----------------------------


def effective_talent(
    talent_base: float,
    learning_rate: float,
    talent_cap: float,
    shifts_worked: int,
) -> float:
    """Bounded learning curve.

    n=0 -> talent_base.
    n->inf -> talent_cap.
    Monotone increasing when talent_cap >= talent_base and learning_rate >= 0.
    """
    _require_positive_float("talent_base", talent_base)
    _require_non_negative_float("learning_rate", learning_rate)
    _require_positive_float("talent_cap", talent_cap)

    if talent_cap < talent_base:
        raise ValueError("error.patterns.talent_cap.below_base")

    if isinstance(shifts_worked, bool):
        raise TypeError("error.patterns.shifts_worked.bool_unsupported")
    if not isinstance(shifts_worked, int):
        raise TypeError("error.patterns.shifts_worked.not_int")
    if shifts_worked < 0:
        raise ValueError("error.patterns.shifts_worked.negative")

    span = talent_cap - talent_base
    return talent_base + span * (1.0 - math.exp(-learning_rate * shifts_worked))


def seasonal_multiplier(profile: SeasonalProfile, year_progress: float) -> float:
    """Return a yearly sine multiplier.

    year_progress must be normalized by the caller in [0.0, 1.0).
    This keeps patterns.py calendar-agnostic and avoids leap-year drift.
    """
    _require_unit_interval_open("year_progress", year_progress)

    angle = 2.0 * math.pi * (year_progress + profile.phase)
    return 1.0 + profile.amplitude * math.sin(angle)


def is_weekend(day_of_week: int) -> bool:
    """Return True for Saturday/Sunday. date.weekday(): Monday=0, Sunday=6."""
    _require_day_of_week(day_of_week)
    return day_of_week >= 5


def shift_premium(bundle: ScenarioBundle, shift_type: ShiftType) -> float:
    if shift_type is ShiftType.DINNER:
        return bundle.tips.dinner_premium

    if shift_type is ShiftType.LUNCH:
        return 1.0

    raise ValueError("error.patterns.shift_type.unsupported")


def weekend_premium(bundle: ScenarioBundle, day_of_week: int) -> float:
    return bundle.tips.weekend_premium if is_weekend(day_of_week) else 1.0


# --- frozen scenario bundles -------------------------------------------------


_STEADY: Final = ScenarioBundle(
    talent=TalentProfile(
        beta_alpha=2.0,
        beta_beta=2.0,
        talent_floor=0.6,
        talent_ceiling=1.4,
        learning_rate=Range(0.0, 0.005),
        cap_ratio=Range(1.0, 1.10),
    ),
    sales=SalesProfile(
        lunch_orders_lambda=90.0,
        dinner_orders_lambda=150.0,
        bill_mu=3.8,
        bill_sigma=0.5,
        forecast_noise=0.10,
    ),
    tips=TipProfile(
        rate_mu=0.18,
        rate_sigma=0.04,
        rate_floor=0.05,
        rate_ceiling=0.40,
        dinner_premium=1.15,
        weekend_premium=1.10,
        noise_sigma=0.08,
        base_role_weights=RoleTipWeights(
            server=0.45,
            bartender=0.35,
            busser=0.25,
            host=0.18,
            cook=0.15,
            chef=0.18,
        ),
        sales_share_weight=1.0,
    ),
    seasonal=SeasonalProfile(
        amplitude=0.0,
        phase=0.0,
    ),
)

_GROWTH: Final = ScenarioBundle(
    talent=TalentProfile(
        beta_alpha=2.0,
        beta_beta=2.0,
        talent_floor=0.6,
        talent_ceiling=1.4,
        learning_rate=Range(0.02, 0.05),
        cap_ratio=Range(1.15, 1.45),
    ),
    sales=SalesProfile(
        lunch_orders_lambda=95.0,
        dinner_orders_lambda=165.0,
        bill_mu=3.85,
        bill_sigma=0.5,
        forecast_noise=0.12,
    ),
    tips=TipProfile(
        rate_mu=0.185,
        rate_sigma=0.04,
        rate_floor=0.05,
        rate_ceiling=0.40,
        dinner_premium=1.18,
        weekend_premium=1.12,
        noise_sigma=0.08,
        base_role_weights=RoleTipWeights(
            server=0.45,
            bartender=0.35,
            busser=0.25,
            host=0.18,
            cook=0.15,
            chef=0.18,
        ),
        sales_share_weight=1.0,
    ),
    seasonal=SeasonalProfile(
        amplitude=0.0,
        phase=0.0,
    ),
)

_SEASONAL: Final = ScenarioBundle(
    talent=TalentProfile(
        beta_alpha=2.0,
        beta_beta=2.0,
        talent_floor=0.6,
        talent_ceiling=1.4,
        learning_rate=Range(0.0, 0.005),
        cap_ratio=Range(1.0, 1.10),
    ),
    sales=SalesProfile(
        lunch_orders_lambda=90.0,
        dinner_orders_lambda=150.0,
        bill_mu=3.8,
        bill_sigma=0.5,
        forecast_noise=0.10,
    ),
    tips=TipProfile(
        rate_mu=0.18,
        rate_sigma=0.04,
        rate_floor=0.05,
        rate_ceiling=0.40,
        dinner_premium=1.15,
        weekend_premium=1.10,
        noise_sigma=0.08,
        base_role_weights=RoleTipWeights(
            server=0.45,
            bartender=0.35,
            busser=0.25,
            host=0.18,
            cook=0.15,
            chef=0.18,
        ),
        sales_share_weight=1.0,
    ),
    seasonal=SeasonalProfile(
        amplitude=0.20,
        phase=0.0,
    ),
)

_BUNDLES: Final[dict[Scenario, ScenarioBundle]] = {
    "steady": _STEADY,
    "growth": _GROWTH,
    "seasonal": _SEASONAL,
}


def bundle_for(scenario: Scenario) -> ScenarioBundle:
    try:
        return _BUNDLES[scenario]
    except KeyError:
        raise ValueError("error.patterns.scenario.unknown") from None
