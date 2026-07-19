"""Smoke tests da API: projetos, letras, prompts, álbuns, takes, jobs, WS."""

from __future__ import annotations

import numpy as np
import soundfile as sf


def test_system_info(client):
    r = client.get("/api/system/info")
    assert r.status_code == 200
    assert "version" in r.json()


def test_project_lifecycle(client):
    r = client.post("/api/projects", json={"name": "Canção do Mar", "mode": "voice"})
    assert r.status_code == 201
    pid = r.json()["id"]
    assert pid.startswith("cancao-do-mar-")

    r = client.get(f"/api/projects/{pid}")
    assert r.json()["status"] == "em_progresso"

    r = client.patch(f"/api/projects/{pid}", json={"status": "quase"})
    assert r.json()["status"] == "quase"

    r = client.get("/api/projects", params={"status": "quase"})
    assert any(p["id"] == pid for p in r.json())

    r = client.delete(f"/api/projects/{pid}")
    assert r.status_code == 204
    assert client.get(f"/api/projects/{pid}").status_code == 404


def test_lyrics_autosave_and_versions(client):
    pid = client.post("/api/projects", json={"name": "Letra Teste"}).json()["id"]
    r = client.put(f"/api/projects/{pid}/lyrics", json={"text": "primeira linha"})
    assert r.json()["snapshotted"] is True  # primeira gravação sempre versiona

    client.put(f"/api/projects/{pid}/lyrics", json={"text": "linha 2", "snapshot": True})
    versions = client.get(f"/api/projects/{pid}/lyrics/versions").json()
    assert len(versions) >= 2
    assert client.get(f"/api/projects/{pid}/lyrics").json()["text"] == "linha 2"


def test_prompts_history(client):
    pid = client.post("/api/projects", json={"name": "Prompt Teste"}).json()["id"]
    client.put(f"/api/projects/{pid}/prompts/style",
               json={"text": "v1", "template_id": "style-meta-v1", "variables": {}})
    client.put(f"/api/projects/{pid}/prompts/style",
               json={"text": "v2", "variables": {}})
    p = client.get(f"/api/projects/{pid}/prompts").json()
    assert p["style"]["current"]["text"] == "v2"
    assert p["style"]["history_count"] == 1


def test_templates_render_endpoint(client):
    r = client.post("/api/prompt-templates/render",
                    json={"template_id": "lyrics-meta-v1",
                          "variables": {"tema": "saudade", "artista": "X"}})
    assert r.status_code == 200
    assert "saudade" in r.json()["text"]


def test_meta_tags_endpoint(client):
    r = client.get("/api/meta-tags")
    assert r.status_code == 200
    assert len(r.json()) > 20


def test_pipeline_stages_endpoint(client):
    r = client.get("/api/pipeline/stages")
    stages = r.json()
    ids = {s["id"] for s in stages}
    assert {"highpass", "deesser", "loudness", "trim_silence"} <= ids
    hp = next(s for s in stages if s["id"] == "highpass")
    assert "params_schema" in hp and hp["available"] is True


def test_presets_endpoint(client):
    r = client.get("/api/presets")
    ids = {p["id"] for p in r.json()}
    assert {"suno-voices", "generic-clean", "raw"} <= ids


def test_album_membership(client):
    p1 = client.post("/api/projects", json={"name": "A"}).json()["id"]
    p2 = client.post("/api/projects", json={"name": "B"}).json()["id"]
    aid = client.post("/api/albums", json={"name": "Álbum 1"}).json()["id"]
    client.patch(f"/api/albums/{aid}", json={"project_ids": [p2, p1]})
    alb = client.get(f"/api/albums/{aid}").json()
    assert alb["project_ids"] == [p2, p1]
    assert client.get(f"/api/projects/{p1}").json()["album_id"] == aid


def test_take_audio_range(client, data_root):
    from app.deps import get_library

    library = get_library()  # mesmo singleton que a API usa
    pid = client.post("/api/projects", json={"name": "Take Teste"}).json()["id"]
    take_id, tdir = library.create_take(pid)
    sr = 48000
    data = (0.2 * np.sin(2 * np.pi * 220 * np.arange(sr) / sr)).astype(np.float32)
    sf.write(tdir / "raw.wav", data, sr, subtype="PCM_24")
    from app.models import Take
    library.save_take(Take(id=take_id, project_id=pid, duration_s=1.0, sample_rate=sr))

    full = client.get(f"/api/takes/{take_id}/audio")
    assert full.status_code == 200
    size = int(full.headers["content-length"])

    partial = client.get(f"/api/takes/{take_id}/audio", headers={"Range": "bytes=0-99"})
    assert partial.status_code == 206
    assert partial.headers["content-range"] == f"bytes 0-99/{size}"
    assert len(partial.content) == 100


def test_ws_jobs_receives_events(client):
    from app.deps import get_jobs

    with client.websocket_connect("/ws/jobs") as ws:
        job = get_jobs().submit("test", lambda ctx: {"done": True})
        seen = set()
        for _ in range(6):
            evt = ws.receive_json()
            assert evt["type"] == "job"
            seen.add(evt["status"])
            if evt["id"] == job.id and evt["status"] == "done":
                break
        assert "done" in seen
