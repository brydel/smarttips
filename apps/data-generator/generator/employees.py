from __future__ import annotations

import math
import re
import unicodedata
from datetime import timedelta
from typing import Final

import numpy as np
from faker import Faker

from generator import rng
from generator._ids import employee_id
from generator.config import GeneratorConfig
from generator.domain import Employee, EmployeeLatentProfile, EmployeeRole
from generator.patterns import Range, ScenarioBundle

# Role mix declared in fixed order. Must stay aligned with EmployeeRole / Prisma.
_ROLE_MIX: Final[tuple[tuple[EmployeeRole, float], ...]] = (
    (EmployeeRole.SERVER, 0.45),
    (EmployeeRole.BARTENDER, 0.15),
    (EmployeeRole.BUSSER, 0.15),
    (EmployeeRole.HOST, 0.10),
    (EmployeeRole.COOK, 0.10),
    (EmployeeRole.CHEF, 0.05),
)

_MAX_TENURE_DAYS: Final = 365 * 3
_EMAIL_DOMAIN: Final = "example.test"


def _validate_role_mix() -> None:
    total = 0.0
    seen: set[EmployeeRole] = set()

    for role, weight in _ROLE_MIX:
        if role in seen:
            raise ValueError("error.employees.role_mix.duplicate_role")
        seen.add(role)

        if not math.isfinite(weight):
            raise ValueError("error.employees.role_mix.weight_not_finite")
        if weight <= 0.0:
            raise ValueError("error.employees.role_mix.weight_not_positive")

        total += weight

    if not math.isclose(total, 1.0, rel_tol=0.0, abs_tol=1e-12):
        raise ValueError("error.employees.role_mix.sum_invalid")


_validate_role_mix()


def _slugify_email_part(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii").lower()
    slug = re.sub(r"[^a-z0-9]+", ".", ascii_text).strip(".")

    return slug or "employee"


def _employee_email(first_name: str, last_name: str, index: int) -> str:
    first = _slugify_email_part(first_name)
    last = _slugify_email_part(last_name)

    return f"{first}.{last}.{index}@{_EMAIL_DOMAIN}"


def _rescale_beta(unit: float, floor: float, ceiling: float) -> float:
    if not math.isfinite(unit):
        raise ValueError("error.employees.beta_unit.not_finite")
    if unit < 0.0 or unit > 1.0:
        raise ValueError("error.employees.beta_unit.out_of_range")

    return floor + (ceiling - floor) * unit


def _sample_range(generator: np.random.Generator, interval: Range) -> float:
    if interval.lo == interval.hi:
        return interval.lo

    return float(generator.uniform(interval.lo, interval.hi))


def _role_sequence(employee_count: int, seed: int) -> tuple[EmployeeRole, ...]:
    """Build a deterministic workforce composition from role weights.

    We use largest remainder allocation instead of independent random draws.
    With only 12 employees, independent sampling can accidentally produce an
    unrealistic workforce composition.
    """
    raw_counts = [(role, employee_count * weight) for role, weight in _ROLE_MIX]
    base_counts = [(role, math.floor(raw)) for role, raw in raw_counts]

    assigned = sum(count for _, count in base_counts)
    remaining = employee_count - assigned

    remainders = sorted(
        ((raw - math.floor(raw), role) for role, raw in raw_counts),
        key=lambda item: (-item[0], item[1].value),
    )

    counts: dict[EmployeeRole, int] = dict(base_counts)

    for _, role in remainders[:remaining]:
        counts[role] += 1

    roles: list[EmployeeRole] = []
    for role, _ in _ROLE_MIX:
        roles.extend([role] * counts[role])

    # Dedicated named stream. Do not use domain_stream(seed, EMPLOYEES) here:
    # that would create hidden coupling with future employee-domain operations.
    role_rng = rng.role_shuffle_stream(seed)
    role_rng.shuffle(roles)

    return tuple(roles)


def generate_employees(
    config: GeneratorConfig,
    bundle: ScenarioBundle,
) -> tuple[tuple[Employee, ...], tuple[EmployeeLatentProfile, ...]]:
    talent = bundle.talent
    roles = _role_sequence(config.employee_count, config.seed)

    employees: list[Employee] = []
    profiles: list[EmployeeLatentProfile] = []

    for index in range(config.employee_count):
        stream = rng.indexed_stream(config.seed, rng.EMPLOYEES, index)

        faker = Faker(config.locale)
        faker.seed_instance(rng.faker_seed(config.seed, rng.EMPLOYEES, index))

        first_name = faker.first_name()
        last_name = faker.last_name()
        email = _employee_email(first_name, last_name, index)

        employee_uuid = employee_id(config.tenant_id, index)
        role = roles[index]

        tenure_days = int(stream.integers(0, _MAX_TENURE_DAYS + 1))
        hired_at = config.start_date - timedelta(days=tenure_days)

        employees.append(
            Employee(
                id=employee_uuid,
                first_name=first_name,
                last_name=last_name,
                email=email,
                role=role,
                hired_at=hired_at,
            )
        )

        beta_unit = float(stream.beta(talent.beta_alpha, talent.beta_beta))
        talent_base = _rescale_beta(
            beta_unit,
            talent.talent_floor,
            talent.talent_ceiling,
        )

        learning_rate = _sample_range(stream, talent.learning_rate)
        cap_ratio = _sample_range(stream, talent.cap_ratio)
        talent_cap = talent_base * cap_ratio

        reliability = float(stream.uniform(0.80, 1.0))

        profiles.append(
            EmployeeLatentProfile(
                employee_id=employee_uuid,
                talent_base=talent_base,
                talent_cap=talent_cap,
                learning_rate=learning_rate,
                reliability=reliability,
            )
        )

    return tuple(employees), tuple(profiles)
