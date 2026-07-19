"""Testes do scanner de importação com árvore sintética (marcadores, acentos, .gdoc)."""

from __future__ import annotations

import json

import numpy as np
import soundfile as sf

from app.importer.markers import analyze_folder_name
from app.importer.scanner import scan_import


def _wav(path, sr=48000, dur=0.2):
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(path, (0.1 * np.sin(2 * np.pi * 200 * np.arange(int(sr * dur)) / sr)).astype("float32"),
             sr, subtype="PCM_16")


class TestMarkers:
    def test_status_and_name(self):
        assert analyze_folder_name("@Deadline")["suggested_status"] == "em_progresso"
        assert analyze_folder_name("#Sob a Luz")["suggested_status"] == "pronto"
        assert analyze_folder_name("%No my boy")["suggested_status"] == "quase"
        assert analyze_folder_name("Fight (quase)")["suggested_status"] == "quase"
        r = analyze_folder_name("-----@Collide")
        assert r["suggested_status"] == "idea"

    def test_numeric_prefix_stripped(self):
        r = analyze_folder_name("03 - Minha Canção")
        assert r["track_hint"] == 3
        assert r["suggested_name"] == "Minha Canção"

    def test_clean_name(self):
        assert analyze_folder_name("@Deadline")["suggested_name"] == "Deadline"
        assert analyze_folder_name("Fight (quase)")["suggested_name"] == "Fight"


class TestScanner:
    def test_scan_song_folders(self, tmp_path):
        # música com 2 versões + letra + gdoc + capa + flp
        d = tmp_path / "@Canção Acentuada (quase)"
        d.mkdir(parents=True, exist_ok=True)
        _wav(d / "v1.wav")
        (d / "v2.mp3").write_bytes(b"ID3fakemp3data")  # scanner só olha a extensão
        (d / "letra.txt").write_text("primeira estrofe da canção", encoding="utf-8")
        (d / "doc.gdoc").write_text(json.dumps({"url": "https://docs.google.com/x"}), encoding="utf-8")
        (d / "capa.jpg").write_bytes(b"\xff\xd8\xff\xe0fakejpeg")
        (d / "projeto.flp").write_bytes(b"FLhd")

        # pasta sem áudio → ignorada
        (tmp_path / "vazia").mkdir()
        (tmp_path / "vazia" / "notas.txt").write_text("x", encoding="utf-8")

        result = scan_import(str(tmp_path))
        assert result["scanned_folders"] == 1
        item = result["items"][0]
        assert item["suggested_name"] == "Canção Acentuada"
        assert item["suggested_status"] in ("quase", "em_progresso")
        assert len(item["audio"]) == 2
        assert any(a["needs_transcode"] for a in item["audio"])  # mp3
        assert item["lyrics"][0]["preview"].startswith("primeira estrofe")
        assert item["links"][0]["url"] == "https://docs.google.com/x"
        assert item["cover"]["file"] == "capa.jpg"
        assert item["assets"][0]["type"] == "flp"

    def test_path_not_found(self, tmp_path):
        import pytest

        from app.errors import PathNotFoundError
        with pytest.raises(PathNotFoundError):
            scan_import(str(tmp_path / "nao-existe"))

    def test_scan_via_api(self, client, tmp_path):
        d = tmp_path / "Som"
        _wav(d / "Som.wav")
        r = client.post("/api/import/scan", json={"path": str(tmp_path)})
        assert r.status_code == 200
        assert r.json()["scanned_folders"] == 1
