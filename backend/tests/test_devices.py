"""Testes de enumeração/sondagem de dispositivos com sounddevice falso."""

from __future__ import annotations

import pytest
import sounddevice as sd

from app.core import devices
from app.errors import NoInputDeviceError, SampleRateUnsupportedError

FAKE_DEVICES = [
    {
        "name": "Microfone (Realtek) [MME]",
        "hostapi": 0,
        "max_input_channels": 2,
        "max_output_channels": 0,
        "default_samplerate": 44100.0,
    },
    {
        "name": "Alto-falantes",
        "hostapi": 1,
        "max_input_channels": 0,
        "max_output_channels": 2,
        "default_samplerate": 48000.0,
    },
    {
        "name": "Microfone (Realtek)",
        "hostapi": 1,
        "max_input_channels": 2,
        "max_output_channels": 0,
        "default_samplerate": 48000.0,
    },
]

FAKE_HOSTAPIS = (
    {"name": "MME"},
    {"name": "Windows WASAPI"},
)


def _patch_queries(monkeypatch, device_list=FAKE_DEVICES, default_idx=2):
    def fake_query_devices(device=None, kind=None):
        if device is None:
            return device_list
        return device_list[device]

    monkeypatch.setattr(sd, "query_devices", fake_query_devices)
    monkeypatch.setattr(sd, "query_hostapis", lambda index=None: FAKE_HOSTAPIS)
    monkeypatch.setattr(devices, "_default_input_index", lambda: default_idx)


def test_list_input_devices_filters_and_flags(monkeypatch):
    _patch_queries(monkeypatch)
    result = devices.list_input_devices()

    assert [d["id"] for d in result] == [0, 2]  # saída pura ficou de fora

    mme = result[0]
    assert mme["hostapi_name"] == "MME"
    assert mme["hostapi_preferred"] is False
    assert mme["is_default"] is False
    assert mme["max_input_channels"] == 2
    assert mme["default_samplerate"] == 44100.0

    wasapi = result[1]
    assert wasapi["hostapi_name"] == "Windows WASAPI"
    assert wasapi["hostapi_preferred"] is True
    assert wasapi["is_default"] is True


def test_list_input_devices_none_found(monkeypatch):
    outputs_only = [d for d in FAKE_DEVICES if d["max_input_channels"] == 0]
    _patch_queries(monkeypatch, device_list=outputs_only, default_idx=None)
    with pytest.raises(NoInputDeviceError):
        devices.list_input_devices()


def test_list_input_devices_query_raises(monkeypatch):
    def boom(*args, **kwargs):
        raise sd.PortAudioError("PortAudio not initialized")

    monkeypatch.setattr(sd, "query_devices", boom)
    with pytest.raises(NoInputDeviceError):
        devices.list_input_devices()


def test_probe_device_ok(monkeypatch):
    _patch_queries(monkeypatch)
    monkeypatch.setattr(sd, "check_input_settings", lambda **kwargs: None)
    assert devices.probe_device(2) == {"ok": True, "used_samplerate": 48000}


def test_probe_device_falls_back_to_default_rate(monkeypatch):
    _patch_queries(monkeypatch)

    def check(device=None, samplerate=None, **kwargs):
        if samplerate != 44100:
            raise sd.PortAudioError("Invalid sample rate")

    monkeypatch.setattr(sd, "check_input_settings", check)
    assert devices.probe_device(0, samplerate=48000) == {"ok": True, "used_samplerate": 44100}


def test_probe_device_no_rate_works(monkeypatch):
    _patch_queries(monkeypatch)

    def check(**kwargs):
        raise sd.PortAudioError("Invalid sample rate")

    monkeypatch.setattr(sd, "check_input_settings", check)
    with pytest.raises(SampleRateUnsupportedError):
        devices.probe_device(0, samplerate=48000)
