import logging
import logging.config
import re
import sys
from collections.abc import Mapping
from contextvars import ContextVar, Token
from typing import Any

from pythonjsonlogger.json import JsonFormatter

from app.core.config import get_settings

request_id_context: ContextVar[str | None] = ContextVar(
    "request_id",
    default=None,
)

SENSITIVE_FIELD_PATTERN = re.compile(
    r"(token|secret|password|authorization|api[_-]?key|access[_-]?key|private[_-]?key)",
    re.IGNORECASE,
)

LOG_FORMAT = (
    "%(asctime)s %(levelname)s %(name)s %(message)s "
    "%(module)s %(funcName)s %(lineno)d"
)


class SmartTipsJsonFormatter(JsonFormatter):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)

        settings = get_settings()
        self._service_name = settings.app_name
        self._environment = settings.app_env

    def add_fields(
        self,
        log_record: dict[str, Any],
        record: logging.LogRecord,
        message_dict: dict[str, Any],
    ) -> None:
        super().add_fields(log_record, record, message_dict)

        log_record["service"] = self._service_name
        log_record["environment"] = self._environment
        log_record["level"] = record.levelname
        log_record["logger"] = record.name

        request_id = request_id_context.get()
        if request_id is not None:
            log_record["request_id"] = request_id

        self._redact_in_place(log_record)

    def _redact_in_place(self, value: Any) -> None:
        if not isinstance(value, dict):
            return

        for key, item in list(value.items()):
            if SENSITIVE_FIELD_PATTERN.search(str(key)):
                value[key] = "[REDACTED]"
                continue

            if isinstance(item, dict):
                self._redact_in_place(item)
                continue

            if isinstance(item, list):
                value[key] = [self._redact_value(element) for element in item]

    def _redact_value(self, value: Any) -> Any:
        if isinstance(value, dict):
            copied = dict(value)
            self._redact_in_place(copied)
            return copied

        if isinstance(value, list):
            return [self._redact_value(element) for element in value]

        return value


def setup_logging() -> None:
    settings = get_settings()

    logging_config: Mapping[str, Any] = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "json": {
                "()": SmartTipsJsonFormatter,
                "fmt": LOG_FORMAT,
                "rename_fields": {
                    "asctime": "timestamp",
                    "levelname": "level_name",
                    "name": "logger_name",
                },
            },
        },
        "handlers": {
            "default": {
                "class": "logging.StreamHandler",
                "stream": sys.stdout,
                "formatter": "json",
            },
        },
        "root": {
            "level": settings.log_level,
            "handlers": ["default"],
        },
        "loggers": {
            "uvicorn": {
                "level": settings.log_level,
                "handlers": ["default"],
                "propagate": False,
            },
            "uvicorn.error": {
                "level": settings.log_level,
                "handlers": ["default"],
                "propagate": False,
            },
            "uvicorn.access": {
                "level": settings.log_level,
                "handlers": ["default"],
                "propagate": False,
            },
            "app": {
                "level": settings.log_level,
                "handlers": ["default"],
                "propagate": False,
            },
        },
    }

    logging.config.dictConfig(dict(logging_config))


def set_request_id(request_id: str | None) -> Token[str | None]:
    return request_id_context.set(request_id)


def reset_request_id(token: Token[str | None]) -> None:
    request_id_context.reset(token)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)