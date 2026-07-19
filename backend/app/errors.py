"""Erros estruturados — o frontend recebe sempre {error: {code, message_key, detail}}."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    code: str = "INTERNAL_ERROR"
    http_status: int = 500
    message_key: str = "errors.internal"

    def __init__(self, detail: Any = None, *, code: str | None = None,
                 http_status: int | None = None, message_key: str | None = None):
        self.detail = detail
        if code:
            self.code = code
        if http_status:
            self.http_status = http_status
        if message_key:
            self.message_key = message_key
        super().__init__(self.code)


class NotFoundError(AppError):
    code = "NOT_FOUND"
    http_status = 404
    message_key = "errors.not_found"


class NoInputDeviceError(AppError):
    code = "NO_INPUT_DEVICE"
    http_status = 424
    message_key = "errors.no_input_device"


class DeviceBusyError(AppError):
    code = "DEVICE_BUSY"
    http_status = 409
    message_key = "errors.device_busy"


class RecorderBusyError(AppError):
    code = "RECORDER_BUSY"
    http_status = 409
    message_key = "errors.recorder_busy"


class SampleRateUnsupportedError(AppError):
    code = "SAMPLE_RATE_UNSUPPORTED"
    http_status = 424
    message_key = "errors.sample_rate_unsupported"


class ModelNotInstalledError(AppError):
    code = "MODEL_NOT_INSTALLED"
    http_status = 409
    message_key = "errors.model_not_installed"


class BuiltinTemplateError(AppError):
    code = "BUILTIN_TEMPLATE"
    http_status = 409
    message_key = "errors.builtin_template"


class PathNotFoundError(AppError):
    code = "PATH_NOT_FOUND"
    http_status = 400
    message_key = "errors.path_not_found"


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.http_status,
            content={
                "error": {
                    "code": exc.code,
                    "message_key": exc.message_key,
                    "detail": exc.detail,
                }
            },
        )
