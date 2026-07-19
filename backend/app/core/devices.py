"""Enumeração e sondagem de dispositivos de entrada de áudio (sounddevice/PortAudio)."""

from __future__ import annotations

import sounddevice as sd

from app.errors import NoInputDeviceError, SampleRateUnsupportedError

PREFERRED_HOSTAPI_HINT = "WASAPI"


def _default_input_index() -> int | None:
    """Índice do dispositivo de entrada padrão, ou None se indisponível."""
    try:
        device = sd.default.device
        idx = device[0]
    except Exception:
        return None
    if idx is None or (isinstance(idx, int) and idx < 0):
        return None
    return int(idx)


def list_input_devices() -> list[dict]:
    """Lista dispositivos com canais de entrada.

    Retorna [{id, name, hostapi_name, max_input_channels, default_samplerate,
    is_default, hostapi_preferred}]. WASAPI é sinalizado como host API preferida;
    MME/DirectSound entram na lista com hostapi_preferred=False.
    """
    try:
        devices = sd.query_devices()
        hostapis = sd.query_hostapis()
    except Exception as exc:
        raise NoInputDeviceError(str(exc)) from exc

    default_idx = _default_input_index()
    result: list[dict] = []
    for idx, dev in enumerate(devices):
        max_in = int(dev.get("max_input_channels", 0))
        if max_in <= 0:
            continue
        hostapi_idx = dev.get("hostapi", -1)
        try:
            hostapi_name = str(hostapis[hostapi_idx]["name"])
        except (IndexError, KeyError, TypeError):
            hostapi_name = "unknown"
        result.append(
            {
                "id": idx,
                "name": str(dev.get("name", f"device {idx}")),
                "hostapi_name": hostapi_name,
                "max_input_channels": max_in,
                "default_samplerate": float(dev.get("default_samplerate", 0.0)),
                "is_default": idx == default_idx,
                "hostapi_preferred": PREFERRED_HOSTAPI_HINT.lower() in hostapi_name.lower(),
            }
        )

    if not result:
        raise NoInputDeviceError("no input devices found")
    return result


def probe_device(device_id: int, samplerate: int = 48000) -> dict:
    """Verifica se o dispositivo aceita gravação em ``samplerate``.

    Tenta a taxa pedida; se falhar, tenta a taxa padrão do dispositivo.
    Retorna {ok: True, used_samplerate: int}. Se nenhuma taxa funcionar,
    levanta SampleRateUnsupportedError.
    """
    try:
        sd.check_input_settings(device=device_id, samplerate=samplerate, dtype="float32")
        return {"ok": True, "used_samplerate": int(samplerate)}
    except Exception:
        pass

    try:
        info = sd.query_devices(device_id)
        fallback = int(info["default_samplerate"])
        if fallback != samplerate:
            sd.check_input_settings(device=device_id, samplerate=fallback, dtype="float32")
            return {"ok": True, "used_samplerate": fallback}
        raise SampleRateUnsupportedError(
            {"device_id": device_id, "requested": samplerate, "fallback": fallback}
        )
    except SampleRateUnsupportedError:
        raise
    except Exception as exc:
        raise SampleRateUnsupportedError(
            {"device_id": device_id, "requested": samplerate, "reason": str(exc)}
        ) from exc
