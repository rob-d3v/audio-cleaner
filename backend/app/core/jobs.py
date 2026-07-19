"""JobManager — execução assíncrona de tarefas pesadas com progresso via WebSocket.

Dois pools de 1 worker: "heavy" (DSP/ML, serializado para poupar RAM/CPU) e
"io" (downloads/import). Cada transição de estado é publicada para assinantes
asyncio (o broadcaster do /ws/jobs). Cancelamento é cooperativo.
"""

from __future__ import annotations

import asyncio
import logging
import threading
import uuid
from collections import OrderedDict
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime

logger = logging.getLogger(__name__)

MAX_FINISHED = 200
_FINAL_STATES = {"done", "error", "cancelled"}


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


class JobCancelled(Exception):
    """Levantada por check_cancelled() para abortar cooperativamente."""


@dataclass
class Job:
    id: str
    kind: str
    status: str = "queued"  # queued | running | done | error | cancelled
    progress: float = 0.0
    stage: str | None = None
    message_key: str | None = None
    result: dict | None = None
    error: dict | None = None
    created_at: str = field(default_factory=_now_iso)
    started_at: str | None = None
    finished_at: str | None = None

    def event(self) -> dict:
        return {"type": "job", **asdict(self)}


class JobContext:
    """Passado à função do job — reporta progresso e checa cancelamento."""

    def __init__(self, manager: JobManager, job: Job, cancel_event: threading.Event):
        self._manager = manager
        self._job = job
        self._cancel = cancel_event

    def progress(self, fraction: float, *, stage: str | None = None,
                 message_key: str | None = None) -> None:
        self._job.progress = max(0.0, min(1.0, fraction))
        if stage is not None:
            self._job.stage = stage
        if message_key is not None:
            self._job.message_key = message_key
        self._manager._publish(self._job)

    @property
    def cancelled(self) -> bool:
        return self._cancel.is_set()

    def check_cancelled(self) -> None:
        if self._cancel.is_set():
            raise JobCancelled()


class JobManager:
    def __init__(self) -> None:
        self._heavy = ThreadPoolExecutor(max_workers=1, thread_name_prefix="job-heavy")
        self._io = ThreadPoolExecutor(max_workers=1, thread_name_prefix="job-io")
        self._jobs: OrderedDict[str, Job] = OrderedDict()
        self._cancels: dict[str, threading.Event] = {}
        self._subscribers: set[asyncio.Queue] = set()
        self._loop: asyncio.AbstractEventLoop | None = None
        self._lock = threading.Lock()

    def set_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    # -------------------------------------------------------------- pub/sub

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._subscribers.discard(q)

    def _publish(self, job: Job) -> None:
        event = job.event()
        loop = self._loop
        for q in list(self._subscribers):
            if loop is not None and loop.is_running():
                loop.call_soon_threadsafe(q.put_nowait, event)
            else:
                try:
                    q.put_nowait(event)
                except asyncio.QueueFull:
                    pass

    # --------------------------------------------------------------- submit

    def submit(self, kind: str, fn: Callable[[JobContext], dict | None], *,
               pool: str = "heavy") -> Job:
        job = Job(id=uuid.uuid4().hex[:12], kind=kind)
        cancel = threading.Event()
        with self._lock:
            self._jobs[job.id] = job
            self._cancels[job.id] = cancel
            self._evict()
        executor = self._io if pool == "io" else self._heavy
        executor.submit(self._run, job, fn, cancel)
        self._publish(job)
        return job

    def _run(self, job: Job, fn: Callable[[JobContext], dict | None],
             cancel: threading.Event) -> None:
        if cancel.is_set():
            job.status = "cancelled"
            job.finished_at = _now_iso()
            self._publish(job)
            return
        job.status = "running"
        job.started_at = _now_iso()
        self._publish(job)
        ctx = JobContext(self, job, cancel)
        try:
            result = fn(ctx)
            job.result = result if isinstance(result, dict) else None
            job.status = "done"
            job.progress = 1.0
        except JobCancelled:
            job.status = "cancelled"
        except Exception as exc:  # noqa: BLE001
            logger.exception("job %s (%s) falhou", job.id, job.kind)
            job.status = "error"
            job.error = {
                "code": getattr(exc, "code", "PROCESS_FAILED"),
                "message_key": getattr(exc, "message_key", "errors.process_failed"),
                "detail": str(exc),
            }
        finally:
            job.finished_at = _now_iso()
            self._publish(job)

    def cancel(self, job_id: str) -> bool:
        ev = self._cancels.get(job_id)
        if ev is None:
            return False
        ev.set()
        return True

    def get(self, job_id: str) -> Job | None:
        return self._jobs.get(job_id)

    def _evict(self) -> None:
        finished = [jid for jid, j in self._jobs.items() if j.status in _FINAL_STATES]
        excess = len(self._jobs) - MAX_FINISHED
        for jid in finished[:max(0, excess)]:
            self._jobs.pop(jid, None)
            self._cancels.pop(jid, None)
