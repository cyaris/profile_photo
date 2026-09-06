import logging

import pytest

from utils import initialize_logger


def test_initialize_logger_is_idempotent_and_applies_the_requested_level() -> None:
    logger = initialize_logger("pixel-portrait-test-logger", level="DEBUG")
    same_logger = initialize_logger("pixel-portrait-test-logger", level="WARNING")

    assert same_logger is logger
    assert logger.level == logging.WARNING
    assert len(logger.handlers) == 1


def test_initialize_logger_rejects_an_unsupported_formatter() -> None:
    with pytest.raises(ValueError, match="Invalid format"):
        initialize_logger("pixel-portrait-invalid-formatter", frmt=object())
