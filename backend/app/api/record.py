"""Rotas de gravação: dispositivos, start/stop/status.

Persistência do Take acontece aqui (não no RecorderService): o serviço devolve
um dict com os metadados e esta camada constrói o modelo Take e chama
LibraryStore.save_take().
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Form, UploadFile
from pydantic import BaseModel

from app.core.devices import list_input_devices, probe_device
from app.core.recorder import RecorderService, get_recorder
from app.core.upload import save_upload_as_take
from app.deps import get_library
from app.errors import AppError

router = APIRouter(tags=["record"])

# extensão a passar pro ffmpeg conforme o mime que o navegador gravou
_MIME_SUFFIX = {
    "audio/webm": ".webm",
    "audio/ogg": ".ogg",
    "audio/mp4": ".mp4",
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/aac": ".aac",
}


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


@router.post("/record/upload")
async def record_upload(
    library: Annotated[Any, Depends(get_library)],
    file: UploadFile,
    project_id: Annotated[str, Form()],
    session_label: Annotated[str | None, Form()] = None,
) -> dict:
    """Grava um take a partir de áudio capturado NO NAVEGADOR (celular/desktop remoto).

    O front captura via getUserMedia/MediaRecorder e faz upload; convertemos para
    WAV 48k mono aqui. Este é o caminho de gravação quando o servidor é remoto
    (o mic é do cliente, não do servidor)."""
    library.get_project(project_id)  # 404 cedo se o projeto não existe
    suffix = _MIME_SUFFIX.get((file.content_type or "").split(";")[0].strip(), ".webm")
    raw = await file.read()
    if not raw:
        raise AppError("empty upload", code="EMPTY_UPLOAD", http_status=400,
                       message_key="errors.empty_upload")
    try:
        return save_upload_as_take(library, project_id, raw, suffix=suffix,
                                   session_label=session_label)
    except RuntimeError as exc:
        if str(exc) == "ffmpeg_missing":
            raise AppError("ffmpeg required", code="FFMPEG_MISSING", http_status=409,
                           message_key="errors.ffmpeg_missing") from exc
        raise AppError(str(exc), code="DECODE_FAILED", http_status=400,
                       message_key="errors.decode_failed") from exc
