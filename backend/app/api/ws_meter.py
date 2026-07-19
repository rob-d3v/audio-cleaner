"""WebSocket /ws/meter — transmite MeterFrames e eventos de estado de gravação.

Múltiplos clientes: um broadcaster único registra-se como on_meter/on_event do
RecorderService e replica cada mensagem para as filas asyncio das conexões
ativas. A thread escritora do recorder publica via loop.call_soon_threadsafe
(set_loop), então os callbacks abaixo sempre rodam no event loop.
"""

from __future__ import annotations

import asyncio
import contextlib
from dataclasses import asdict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.recorder import RecorderService, get_recorder

router = APIRouter()

QUEUE_MAXSIZE = 256


class MeterBroadcaster:
    """Fan-out de frames/eventos do recorder para todas as conexões WS."""

    def __init__(self) -> None:
        self._queues: set[asyncio.Queue] = set()
        self._installed = False

    def install(self, recorder: RecorderService, loop: asyncio.AbstractEventLoop) -> None:
        recorder.set_loop(loop)
        if not self._installed:
            recorder.on_meter = self._on_meter
            recorder.on_event = self._on_event
            self._installed = True

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=QUEUE_MAXSIZE)
        self._queues.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._queues.discard(q)

    def _broadcast(self, message: dict) -> None:
        for q in list(self._queues):
            with contextlib.suppress(asyncio.QueueFull):
                q.put_nowait(message)

    def _on_meter(self, frame) -> None:  # roda no event loop
        self._broadcast({"type": "meter", **asdict(frame)})

    def _on_event(self, event: dict) -> None:  # roda no event loop
        self._broadcast(event)


broadcaster = MeterBroadcaster()


@router.websocket("/ws/meter")
async def ws_meter(websocket: WebSocket) -> None:
    await websocket.accept()
    recorder = get_recorder()
    broadcaster.install(recorder, asyncio.get_running_loop())
    q = broadcaster.subscribe()

    # Estado atual na conexão, para o cliente sincronizar a UI.
    await websocket.send_json({"type": "record_state", **recorder.status()})

    recv_task: asyncio.Task | None = None
    get_task: asyncio.Task | None = None
    try:
        recv_task = asyncio.create_task(websocket.receive())
        while True:
            get_task = asyncio.create_task(q.get())
            done, _pending = await asyncio.wait(
                {recv_task, get_task}, return_when=asyncio.FIRST_COMPLETED
            )
            if recv_task in done:
                message = recv_task.result()
                if message.get("type") == "websocket.disconnect":
                    break
                recv_task = asyncio.create_task(websocket.receive())  # ignora pings de texto
            if get_task in done:
                await websocket.send_json(get_task.result())
            else:
                get_task.cancel()
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        for task in (recv_task, get_task):
            if task is not None and not task.done():
                task.cancel()
        broadcaster.unsubscribe(q)
