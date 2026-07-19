"""Configuração do app — diretório de dados, alvos de gravação, ajustes do usuário."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from platformdirs import user_data_dir
from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict

APP_NAME = "AudioCleaner"


class Settings(BaseSettings):
    """Configuração de processo (env vars com prefixo AUDIO_CLEANER_)."""

    model_config = SettingsConfigDict(env_prefix="AUDIO_CLEANER_")

    data_dir: Path | None = None
    host: str = "127.0.0.1"
    port: int = 8000

    def resolved_data_dir(self) -> Path:
        return self.data_dir or Path(user_data_dir(APP_NAME, appauthor=False))


class UserSettings(BaseModel):
    """Ajustes persistidos em settings.json dentro do data dir."""

    schema_version: int = 1
    language: str = "pt-BR"
    default_device_id: int | None = None
    lufs_target: float = -18.0
    import_recent_paths: list[str] = []
    import_marker_mapping: dict[str, str] = {
        "(quase)": "quase",
        "%": "quase",
        "#": "pronto",
        "@": "em_progresso",
        "-----": "idea",
    }


@lru_cache
def get_settings() -> Settings:
    return Settings()


def data_dir() -> Path:
    d = get_settings().resolved_data_dir()
    d.mkdir(parents=True, exist_ok=True)
    return d


def _settings_file() -> Path:
    return data_dir() / "settings.json"


def load_user_settings() -> UserSettings:
    f = _settings_file()
    if f.exists():
        try:
            return UserSettings.model_validate_json(f.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            pass
    return UserSettings()


def save_user_settings(settings: UserSettings) -> None:
    f = _settings_file()
    tmp = f.with_suffix(".json.tmp")
    tmp.write_text(
        json.dumps(settings.model_dump(), ensure_ascii=False, indent=2), encoding="utf-8"
    )
    tmp.replace(f)
