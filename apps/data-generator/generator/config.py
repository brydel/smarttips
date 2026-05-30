from datetime import date, timedelta
from pathlib import Path
from typing import Literal
from uuid import UUID

from pydantic import Field, computed_field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from generator._ids import make_tenant_id

Scenario = Literal["steady", "growth", "seasonal"]


class GeneratorConfig(BaseSettings):
    """Operational knobs for synthetic dataset generation.

    Holds only reproducibility-safe settings: master seed, time window,
    entity counts, locale, output location and the namespacing root.

    Generative ground truth (distribution params, tip-formula coefficients)
    lives code-pinned in patterns.py and is deliberately NOT exposed here:
    making it env-overridable would let two runs claim the same seed yet
    diverge, breaking byte-for-byte repro and reintroducing train/serve skew.
    """

    model_config = SettingsConfigDict(
        env_file=".env.generator",
        env_file_encoding="utf-8",
        env_prefix="GENERATOR_",
        extra="forbid",
        case_sensitive=False,
        frozen=True,
    )

    seed: int = Field(
        ge=0,
        le=2**32 - 1,
        description=(
            "master seed for deterministic generation; required and bounded to "
            "the legacy numpy seed range for portable reproducibility"
        ),
    )

    start_date: date = Field(
        default=date(2026, 1, 1),
        description="first day of the generated window; stable default for repro",
    )

    days: int = Field(
        default=90,
        ge=1,
        le=365,
        description="number of consecutive days to generate",
    )

    employee_count: int = Field(
        default=12,
        ge=1,
        le=50,
        description="number of employees in the synthetic restaurant",
    )

    scenario: Scenario = Field(
        default="steady",
        description=(
            "selects a frozen bundle of distribution presets in patterns.py; "
            "semantic knob that gives demo variety without leaking raw params"
        ),
    )

    locale: Literal["en_CA", "fr_CA"] = Field(
        default="en_CA",
        description="faker locale for realistic canadian employee names",
    )

    output_dir: Path = Field(
        default=Path("./data/synthetic"),
        description="directory where json and csv outputs are written",
    )

    tenant_namespace: UUID = Field(
        default=UUID("00000000-0000-0000-0000-000000000001"),
        description="uuid5 namespace root for all deterministic entity ids",
    )

    @field_validator("output_dir")
    @classmethod
    def expand_output_dir(cls, value: Path) -> Path:
        return value.expanduser()

    @model_validator(mode="after")
    def check_period_bounds(self) -> "GeneratorConfig":
        # Compute backwards from date.max so we never construct an
        # out-of-range date: date.max + 1 day raises OverflowError before
        # any comparison could run.
        max_start = date.max - timedelta(days=self.days - 1)

        if self.start_date > max_start:
            raise ValueError("error.config.period.overflow")

        return self

    @computed_field  # type: ignore[prop-decorator]
    @property
    def tenant_id(self) -> UUID:
        # make_tenant_id is the single source of truth for tenant identity.
        # Same seed -> same tenant, different seed -> isolated tenant.
        return make_tenant_id(self.tenant_namespace, self.seed)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def end_date(self) -> date:
        # Safe because check_period_bounds() rejects overflowing periods.
        return self.start_date + timedelta(days=self.days - 1)