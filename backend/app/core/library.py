"""LibraryStore — persistência filesystem+JSON de projetos, takes, letras, prompts e álbuns.

Layout em data_dir():
    projects/{project_id}/project.json, cover.jpg|png, notes.md,
        lyrics/current.txt, lyrics/versions/{YYYYMMDDTHHMMSS}.txt,
        prompts.json, takes/{take_id}/raw.wav, take.json, processed/{chain_hash}.wav
    albums/{album_id}.json
    trash/  (projetos/álbuns/takes deletados, com prefixo de timestamp)
"""

from __future__ import annotations

import logging
import os
import re
import shutil
import unicodedata
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from pydantic import BaseModel, ValidationError

from app.config import data_dir
from app.errors import AppError, NotFoundError
from app.models import (
    PROMPT_HISTORY_MAX,
    Album,
    Project,
    ProjectPrompts,
    PromptEntry,
    PromptKind,
    Take,
)

logger = logging.getLogger(__name__)

_TS_FMT = "%Y%m%dT%H%M%S"
_TS_RE = re.compile(r"^\d{8}T\d{6}$")
_TAKE_RE = re.compile(r"^take-(\d+)$")
_VARIANT_RE = re.compile(r"^[A-Za-z0-9_-]+$")
_SNAPSHOT_MIN_AGE = timedelta(minutes=10)

_PROJECT_PATCH_FIELDS = frozenset(
    {"name", "status", "mode", "album_id", "track_hint", "best_take_id", "cover",
     "links", "import_info"}
)
_TAKE_PATCH_FIELDS = frozenset(
    {"rating", "notes", "session_label", "duration_s", "sample_rate", "channels",
     "device", "origin", "original_file", "transcoded", "processed"}
)
_ALBUM_PATCH_FIELDS = frozenset({"name", "cover_project_id"})


def _now() -> datetime:
    """Fonte única de tempo (monkeypatchável em testes)."""
    return datetime.now(UTC)


def now_iso() -> str:
    return _now().isoformat()


def _ts() -> str:
    return _now().strftime(_TS_FMT)


def _parse_ts(ts: str) -> datetime:
    return datetime.strptime(ts, _TS_FMT).replace(tzinfo=UTC)


def _fold(text: str) -> str:
    """Remove acentos e baixa a caixa (busca e slug insensíveis a acento)."""
    norm = unicodedata.normalize("NFKD", text)
    return "".join(c for c in norm if not unicodedata.combining(c)).casefold()


def slugify(name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", _fold(name)).strip("-")
    return base or "item"


def _shortid() -> str:
    return uuid.uuid4().hex[:4]


def _atomic_write_bytes(path: Path, data: bytes) -> None:
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_bytes(data)
    os.replace(tmp, path)


def _atomic_write_text(path: Path, text: str) -> None:
    _atomic_write_bytes(path, text.encode("utf-8"))


def _atomic_write_model(path: Path, model: BaseModel) -> None:
    _atomic_write_text(path, model.model_dump_json(indent=2))


class LibraryStore:
    """Índice em memória + persistência JSON no filesystem."""

    def __init__(self, root: Path | None = None) -> None:
        self.root = Path(root) if root is not None else data_dir()
        self.projects_dir = self.root / "projects"
        self.albums_dir = self.root / "albums"
        self.trash_dir = self.root / "trash"
        for d in (self.projects_dir, self.albums_dir, self.trash_dir):
            d.mkdir(parents=True, exist_ok=True)
        self._projects: dict[str, Project] = {}
        self._albums: dict[str, Album] = {}
        self._takes: dict[str, str] = {}  # take_id -> project_id
        self._scan()

    # ------------------------------------------------------------------ scan

    def _scan(self) -> None:
        for pdir in sorted(self.projects_dir.iterdir()):
            if not pdir.is_dir():
                continue
            f = pdir / "project.json"
            if not f.exists():
                logger.warning("diretório de projeto sem project.json, ignorando: %s", pdir)
                continue
            try:
                proj = Project.model_validate_json(f.read_text(encoding="utf-8"))
            except (ValidationError, ValueError, OSError):
                logger.warning("project.json corrompido, ignorando: %s", f)
                continue
            self._projects[proj.id] = proj
            takes_dir = pdir / "takes"
            if takes_dir.is_dir():
                for tdir in takes_dir.iterdir():
                    if tdir.is_dir():
                        self._takes[tdir.name] = proj.id
        for f in sorted(self.albums_dir.glob("*.json")):
            try:
                alb = Album.model_validate_json(f.read_text(encoding="utf-8"))
            except (ValidationError, ValueError, OSError):
                logger.warning("album json corrompido, ignorando: %s", f)
                continue
            self._albums[alb.id] = alb

    # ----------------------------------------------------------------- paths

    def project_dir(self, project_id: str) -> Path:
        return self.projects_dir / project_id

    def _project_file(self, project_id: str) -> Path:
        return self.project_dir(project_id) / "project.json"

    def _write_project(self, proj: Project) -> None:
        self.project_dir(proj.id).mkdir(parents=True, exist_ok=True)
        _atomic_write_model(self._project_file(proj.id), proj)

    def _album_file(self, album_id: str) -> Path:
        return self.albums_dir / f"{album_id}.json"

    def _write_album(self, alb: Album) -> None:
        _atomic_write_model(self._album_file(alb.id), alb)

    def _move_to_trash(self, src: Path) -> Path:
        dst = self.trash_dir / f"{_ts()}-{src.name}"
        while dst.exists():
            dst = self.trash_dir / f"{_ts()}-{_shortid()}-{src.name}"
        shutil.move(str(src), str(dst))
        return dst

    # -------------------------------------------------------------- projects

    def list_projects(self, status: str | None = None, album_id: str | None = None,
                      q: str | None = None) -> list[Project]:
        items = list(self._projects.values())
        if status is not None:
            items = [p for p in items if p.status == status]
        if album_id is not None:
            items = [p for p in items if p.album_id == album_id]
        if q:
            needle = _fold(q)
            items = [p for p in items if needle in _fold(p.name)]
        return sorted(items, key=lambda p: p.updated_at, reverse=True)

    def get_project(self, project_id: str) -> Project:
        proj = self._projects.get(project_id)
        if proj is None:
            raise NotFoundError(f"project {project_id}")
        return proj

    def create_project(self, name: str, mode: str = "voice") -> Project:
        base = slugify(name)
        pid = f"{base}-{_shortid()}"
        while pid in self._projects or self.project_dir(pid).exists():
            pid = f"{base}-{_shortid()}"
        ts = now_iso()
        proj = Project(id=pid, name=name, mode=mode, created_at=ts, updated_at=ts)
        self._projects[pid] = proj
        self._write_project(proj)
        return proj

    def _set_project_fields(self, project_id: str, **fields: Any) -> Project:
        """Atualização interna sem sincronização de álbum (evita recursão)."""
        cur = self.get_project(project_id)
        data = cur.model_dump()
        data.update(fields)
        data["updated_at"] = now_iso()
        proj = Project.model_validate(data)
        self._projects[project_id] = proj
        self._write_project(proj)
        return proj

    def update_project(self, project_id: str, patch: dict[str, Any]) -> Project:
        cur = self.get_project(project_id)
        changes = {k: v for k, v in patch.items() if k in _PROJECT_PATCH_FIELDS}
        album_changed = "album_id" in changes and changes["album_id"] != cur.album_id
        if album_changed and changes["album_id"] is not None:
            self.get_album(changes["album_id"])  # valida antes de gravar
        data = cur.model_dump()
        data.update(changes)
        data["updated_at"] = now_iso()
        proj = Project.model_validate(data)
        self._projects[project_id] = proj
        self._write_project(proj)
        if album_changed:
            if cur.album_id:
                old = self._albums.get(cur.album_id)
                if old and project_id in old.project_ids:
                    old.project_ids.remove(project_id)
                    self._write_album(old)
            if proj.album_id:
                alb = self._albums[proj.album_id]
                if project_id not in alb.project_ids:
                    alb.project_ids.append(project_id)
                    self._write_album(alb)
        return proj

    def delete_project(self, project_id: str) -> None:
        proj = self.get_project(project_id)
        pdir = self.project_dir(project_id)
        if pdir.exists():
            self._move_to_trash(pdir)
        del self._projects[project_id]
        self._takes = {t: p for t, p in self._takes.items() if p != project_id}
        if proj.album_id:
            alb = self._albums.get(proj.album_id)
            if alb and project_id in alb.project_ids:
                alb.project_ids.remove(project_id)
                self._write_album(alb)

    # ----------------------------------------------------------------- cover

    def cover_path(self, project_id: str) -> Path | None:
        self.get_project(project_id)
        for ext in ("jpg", "png"):
            p = self.project_dir(project_id) / f"cover.{ext}"
            if p.exists():
                return p
        return None

    def save_cover(self, project_id: str, data: bytes, ext: str) -> Path:
        self.get_project(project_id)
        if ext not in ("jpg", "png"):
            raise AppError(f"extensão de capa inválida: {ext}", code="INVALID_COVER",
                           http_status=400, message_key="errors.invalid_cover")
        pdir = self.project_dir(project_id)
        target = pdir / f"cover.{ext}"
        _atomic_write_bytes(target, data)
        other = pdir / ("cover.png" if ext == "jpg" else "cover.jpg")
        if other.exists():
            other.unlink()
        self._set_project_fields(project_id, cover=True)
        return target

    def delete_cover(self, project_id: str) -> None:
        proj = self.get_project(project_id)
        removed = False
        for ext in ("jpg", "png"):
            p = self.project_dir(project_id) / f"cover.{ext}"
            if p.exists():
                p.unlink()
                removed = True
        if removed or proj.cover:
            self._set_project_fields(project_id, cover=False)

    # ----------------------------------------------------------------- notes

    def get_notes(self, project_id: str) -> str:
        self.get_project(project_id)
        f = self.project_dir(project_id) / "notes.md"
        return f.read_text(encoding="utf-8") if f.exists() else ""

    def save_notes(self, project_id: str, text: str) -> None:
        self.get_project(project_id)
        _atomic_write_text(self.project_dir(project_id) / "notes.md", text)

    # ---------------------------------------------------------------- lyrics

    def _lyrics_dir(self, project_id: str) -> Path:
        return self.project_dir(project_id) / "lyrics"

    def _versions_dir(self, project_id: str) -> Path:
        return self._lyrics_dir(project_id) / "versions"

    def _version_files(self, project_id: str) -> list[Path]:
        vd = self._versions_dir(project_id)
        return sorted(vd.glob("*.txt")) if vd.is_dir() else []

    def _snapshot(self, project_id: str, text: str) -> str:
        """Grava uma versão com timestamp único (bump de segundos em colisão)."""
        vd = self._versions_dir(project_id)
        vd.mkdir(parents=True, exist_ok=True)
        t = _now()
        while True:
            path = vd / f"{t.strftime(_TS_FMT)}.txt"
            if not path.exists():
                break
            t += timedelta(seconds=1)
        _atomic_write_text(path, text)
        return path.stem

    def get_lyrics(self, project_id: str) -> dict[str, Any]:
        self.get_project(project_id)
        current = self._lyrics_dir(project_id) / "current.txt"
        if current.exists():
            text = current.read_text(encoding="utf-8")
            updated_at = datetime.fromtimestamp(
                current.stat().st_mtime, tz=UTC
            ).isoformat()
        else:
            text, updated_at = "", None
        return {"text": text, "updated_at": updated_at,
                "version_count": len(self._version_files(project_id))}

    def save_lyrics(self, project_id: str, text: str, snapshot: bool = False) -> dict[str, Any]:
        """Grava current.txt; snapshot automático se:
        snapshot=True explícito, OU primeira gravação do dia, OU última versão
        com mais de 10 min e texto mudou."""
        self.get_project(project_id)
        ldir = self._lyrics_dir(project_id)
        ldir.mkdir(parents=True, exist_ok=True)
        now = _now()
        versions = self._version_files(project_id)
        do_snapshot = snapshot
        if not do_snapshot:
            if not versions:
                do_snapshot = True
            else:
                today = now.strftime("%Y%m%d")
                if not any(v.stem.startswith(today) for v in versions):
                    do_snapshot = True
                else:
                    last = versions[-1]
                    if (now - _parse_ts(last.stem)) > _SNAPSHOT_MIN_AGE and \
                            last.read_text(encoding="utf-8") != text:
                        do_snapshot = True
        _atomic_write_text(ldir / "current.txt", text)
        if do_snapshot:
            self._snapshot(project_id, text)
        return {"updated_at": now.isoformat(), "snapshotted": do_snapshot,
                "version_count": len(self._version_files(project_id))}

    def list_lyric_versions(self, project_id: str) -> list[dict[str, Any]]:
        self.get_project(project_id)
        out: list[dict[str, Any]] = []
        for f in reversed(self._version_files(project_id)):
            text = f.read_text(encoding="utf-8")
            out.append({
                "ts": f.stem,
                "created_at": _parse_ts(f.stem).isoformat(),
                "bytes": f.stat().st_size,
                "preview": text[:120],
            })
        return out

    def get_lyric_version(self, project_id: str, ts: str) -> str:
        self.get_project(project_id)
        if not _TS_RE.match(ts):
            raise NotFoundError(f"lyric version {ts}")
        path = self._versions_dir(project_id) / f"{ts}.txt"
        if not path.exists():
            raise NotFoundError(f"lyric version {ts}")
        return path.read_text(encoding="utf-8")

    def restore_lyric_version(self, project_id: str, ts: str) -> str:
        text = self.get_lyric_version(project_id, ts)
        current = self._lyrics_dir(project_id) / "current.txt"
        if current.exists():
            self._snapshot(project_id, current.read_text(encoding="utf-8"))
        self._lyrics_dir(project_id).mkdir(parents=True, exist_ok=True)
        _atomic_write_text(current, text)
        return text

    # --------------------------------------------------------------- prompts

    def _prompts_file(self, project_id: str) -> Path:
        return self.project_dir(project_id) / "prompts.json"

    def get_prompts(self, project_id: str) -> ProjectPrompts:
        self.get_project(project_id)
        f = self._prompts_file(project_id)
        if f.exists():
            try:
                return ProjectPrompts.model_validate_json(f.read_text(encoding="utf-8"))
            except (ValidationError, ValueError, OSError):
                logger.warning("prompts.json corrompido, recomeçando: %s", f)
        return ProjectPrompts()

    def set_prompt(self, project_id: str, kind: PromptKind, entry: PromptEntry) -> ProjectPrompts:
        prompts = self.get_prompts(project_id)
        slot = getattr(prompts, kind)
        if slot.current is not None:
            slot.history.insert(0, slot.current)
            del slot.history[PROMPT_HISTORY_MAX:]
        slot.current = entry
        _atomic_write_model(self._prompts_file(project_id), prompts)
        return prompts

    def get_prompt_history(self, project_id: str, kind: PromptKind) -> list[PromptEntry]:
        return getattr(self.get_prompts(project_id), kind).history

    # ----------------------------------------------------------------- takes

    def create_take(self, project_id: str) -> tuple[str, Path]:
        """Aloca take-NNN (numeração global — o id precisa ser único na API /takes)."""
        self.get_project(project_id)
        nums = [int(m.group(1)) for t in self._takes if (m := _TAKE_RE.match(t))]
        take_id = f"take-{(max(nums, default=0) + 1):03d}"
        tdir = self.project_dir(project_id) / "takes" / take_id
        tdir.mkdir(parents=True, exist_ok=True)
        self._takes[take_id] = project_id
        return take_id, tdir

    def take_dir(self, take_id: str) -> Path:
        pid = self._takes.get(take_id)
        if pid is None:
            raise NotFoundError(f"take {take_id}")
        return self.project_dir(pid) / "takes" / take_id

    def save_take(self, take: Take) -> None:
        self.get_project(take.project_id)
        tdir = self.project_dir(take.project_id) / "takes" / take.id
        tdir.mkdir(parents=True, exist_ok=True)
        _atomic_write_model(tdir / "take.json", take)
        self._takes[take.id] = take.project_id

    def get_take(self, take_id: str) -> Take:
        f = self.take_dir(take_id) / "take.json"
        if not f.exists():
            raise NotFoundError(f"take {take_id}")
        return Take.model_validate_json(f.read_text(encoding="utf-8"))

    def list_takes(self, project_id: str) -> list[Take]:
        self.get_project(project_id)
        takes_dir = self.project_dir(project_id) / "takes"
        out: list[Take] = []
        if takes_dir.is_dir():
            for f in sorted(takes_dir.glob("*/take.json")):
                try:
                    out.append(Take.model_validate_json(f.read_text(encoding="utf-8")))
                except (ValidationError, ValueError, OSError):
                    logger.warning("take.json inválido, ignorando: %s", f)
        return out

    def update_take(self, take_id: str, patch: dict[str, Any]) -> Take:
        cur = self.get_take(take_id)
        data = cur.model_dump()
        data.update({k: v for k, v in patch.items() if k in _TAKE_PATCH_FIELDS})
        take = Take.model_validate(data)
        self.save_take(take)
        return take

    def delete_take(self, take_id: str) -> None:
        tdir = self.take_dir(take_id)
        pid = self._takes[take_id]
        if tdir.exists():
            self._move_to_trash(tdir)
        del self._takes[take_id]
        proj = self._projects.get(pid)
        if proj and proj.best_take_id == take_id:
            self._set_project_fields(pid, best_take_id=None)

    def take_audio_path(self, take_id: str, variant: str = "raw") -> Path:
        tdir = self.take_dir(take_id)
        if variant == "raw":
            path = tdir / "raw.wav"
        else:
            if not _VARIANT_RE.match(variant):
                raise NotFoundError(f"variant {variant}")
            path = tdir / "processed" / f"{variant}.wav"
        if not path.exists():
            raise NotFoundError(f"audio {take_id}/{variant}")
        return path

    # ---------------------------------------------------------------- albums

    def list_albums(self) -> list[Album]:
        return sorted(self._albums.values(), key=lambda a: (a.created_at, a.id))

    def get_album(self, album_id: str) -> Album:
        alb = self._albums.get(album_id)
        if alb is None:
            raise NotFoundError(f"album {album_id}")
        return alb

    def create_album(self, name: str) -> Album:
        base = slugify(name)
        aid = f"{base}-{_shortid()}"
        while aid in self._albums or self._album_file(aid).exists():
            aid = f"{base}-{_shortid()}"
        alb = Album(id=aid, name=name, created_at=now_iso())
        self._albums[aid] = alb
        self._write_album(alb)
        return alb

    def update_album(self, album_id: str, patch: dict[str, Any]) -> Album:
        alb = self.get_album(album_id)
        if patch.get("project_ids") is not None:
            alb = self.set_album_projects(album_id, list(patch["project_ids"]))
        changes = {k: v for k, v in patch.items() if k in _ALBUM_PATCH_FIELDS}
        if changes:
            data = alb.model_dump()
            data.update(changes)
            alb = Album.model_validate(data)
            self._albums[album_id] = alb
            self._write_album(alb)
        return alb

    def set_album_projects(self, album_id: str, project_ids: list[str]) -> Album:
        """Reordena/define membros mantendo a invariante: projeto em no máximo 1 álbum."""
        alb = self.get_album(album_id)
        new_ids = list(dict.fromkeys(project_ids))
        for pid in new_ids:
            self.get_project(pid)
        removed = [pid for pid in alb.project_ids if pid not in new_ids]
        for pid in new_ids:
            proj = self._projects[pid]
            if proj.album_id and proj.album_id != album_id:
                other = self._albums.get(proj.album_id)
                if other and pid in other.project_ids:
                    other.project_ids.remove(pid)
                    self._write_album(other)
            if proj.album_id != album_id:
                self._set_project_fields(pid, album_id=album_id)
        for pid in removed:
            proj = self._projects.get(pid)
            if proj and proj.album_id == album_id:
                self._set_project_fields(pid, album_id=None)
        alb.project_ids = new_ids
        self._albums[album_id] = alb
        self._write_album(alb)
        return alb

    def delete_album(self, album_id: str) -> None:
        alb = self.get_album(album_id)
        for pid in list(alb.project_ids):
            proj = self._projects.get(pid)
            if proj and proj.album_id == album_id:
                self._set_project_fields(pid, album_id=None)
        f = self._album_file(album_id)
        if f.exists():
            self._move_to_trash(f)
        del self._albums[album_id]
