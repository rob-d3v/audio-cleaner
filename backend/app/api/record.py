"""Rotas de gravação: dispositivos, start/stop/status.

Persistência do Take acontece aqui (não no RecorderService): o serviço devolve
um dict com os metadados e esta camada constrói o modelo Take e chama
LibraryStore.save_take().
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.devices import list_input_devices, probe_device
from app.core.recorder import RecorderService, get_recorder
from app.deps import get_library
from app.errors import AppError

router = APIRouter(tags=["record"])


class RecordStartRequest(BaseModel):
    project_id: str | None = None
    device_id: int | None = None
    monitor_only: bool = False


def _build_take(result: dict) -> Any:
    """Constrói o modelo Take a partir do dict do RecorderService.stop().

    Filtra pelos campos existentes no modelo para tolerar diferenças de schema
    (models.py é mantido por outro módulo).
    """
    from app.models import Take

    device = result.get("device") or {}
    candidates = {
        "id": result["take_id"],
        "take_id": result["take_id"],
        "project_id": result.get("project_id"),
        "duration_s": result["duration_s"],
        "sample_rate": result["sample_rate"],
        "samplerate": result["sample_rate"],
        "channels": result["channels"],
        "path": result.get("path"),
        "filename": "raw.wav",
        "device": device,
        "device_name": device.get("name"),
        "input_overflows": result.get("input_overflows", 0),
    }
    fields = set(getattr(Take, "model_fields", {}))
    return Take(**{k: v for k, v in candidates.items() if k in fields})


@router.get("/devices")
def get_devices() -> list[dict]:
    return list_input_devices()


@router.get("/devices/{device_id}/probe")
def get_device_probe(device_id: int, samplerate: int = 48000) -> dict:
    return probe_device(device_id, samplerate=samplerate)


@router.post("/record/start")
def record_start(
    body: RecordStartRequest,
    recorder: Annotated[RecorderService, Depends(get_recorder)],
    library: Annotated[Any, Depends(get_library)],
) -> dict:
    if body.monitor_only:
        recorder.start_monitor(body.device_id)
        return {"take_id": None}
    if not body.project_id:
        raise AppError(
            "project_id is required unless monitor_only",
            code="VALIDATION_ERROR",
            http_status=422,
            message_key="errors.validation",
        )
    take_id = recorder.start(body.project_id, body.device_id, library)
    return {"take_id": take_id}


@router.post("/record/stop")
def record_stop(
    recorder: Annotated[RecorderService, Depends(get_recorder)],
    library: Annotated[Any, Depends(get_library)],
) -> dict:
    if recorder.status()["monitoring"]:
        recorder.stop_monitor()
        return {"take_id": None, "duration_s": 0.0}
    result = recorder.stop()
    library.save_take(_build_take(result))
    return {"take_id": result["take_id"], "duration_s": result["duration_s"]}


@router.get("/record/status")
def record_status(recorder: Annotated[RecorderService, Depends(get_recorder)]) -> dict:
    return recorder.status()
