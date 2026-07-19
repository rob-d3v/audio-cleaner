"""WebSockets: /ws/jobs (progresso de jobs) e /ws/meter (medição de gravação)."""

from __future__ import annotations

import asyncio
import contextlib

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.deps import get_jobs, get_recorder

router = APIRouter()


@router.websocket("/ws/jobs")
async def ws_jobs(ws: WebSocket) -> None:
    await ws.accept()
    jobs = get_jobs()
    jobs.set_loop(asyncio.get_running_loop())
    q = jobs.subscribe()
    try:
        while True:
            event = await q.get()
            await ws.send_json(event)
    except WebSocketDisconnect:
        pass
    finally:
        jobs.unsubscribe(q)


@router.websocket("/ws/meter")
async def ws_meter(ws: WebSocket) -> None:
    await ws.accept()
    recorder = get_recorder()
    loop = asyncio.get_running_loop()
    recorder.set_loop(loop)
    queue: asyncio.Queue = asyncio.Queue(maxsize=256)

    def _push_meter(frame) -> None:
        with contextlib.suppress(asyncio.QueueFull):
            queue.put_nowait({
                "type": "meter",
                "t": round(getattr(frame, "t", 0.0), 3),
                "rms_db": round(frame.rms_db, 2),
                "peak_db": round(frame.peak_db, 2),
                "peak_hold_db": round(frame.peak_hold_db, 2),
                "clip": bool(frame.clip),
            })

    def _push_event(event: dict) -> None:
        with contextlib.suppress(asyncio.QueueFull):
            queue.put_nowait(event)

    recorder.on_meter = _push_meter
    recorder.on_event = _push_event
    try:
        while True:
            event = await queue.get()
            await ws.send_json(event)
    except WebSocketDisconnect:
        pass
    finally:
        if recorder.on_meter is _push_meter:
            recorder.on_meter = None
        if recorder.on_event is _push_event:
            recorder.on_event = None
