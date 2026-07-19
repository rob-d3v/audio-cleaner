"""Testes do render determinístico de prompts e do catálogo de meta-tags."""

from __future__ import annotations

from app.core import prompt_studio as ps


def test_render_fills_variables(data_root):
    tpl = {
        "template": "{genero}, {humor} mood, {bpm} BPM",
        "variables": [
            {"name": "genero", "default": ""},
            {"name": "humor", "default": ""},
            {"name": "bpm", "default": ""},
        ],
    }
    out = ps.render_template(tpl, {"genero": "rock", "humor": "energético", "bpm": "128"})
    assert out == "rock, energético mood, 128 BPM"


def test_render_cleans_empty_var_separators(data_root):
    tpl = {
        "template": "{a}, {b}, {c}",
        "variables": [{"name": "a", "default": ""}, {"name": "b", "default": ""},
                      {"name": "c", "default": ""}],
    }
    out = ps.render_template(tpl, {"a": "x", "b": "", "c": "z"})
    assert out == "x, z"


def test_render_multiselect_join(data_root):
    tpl = {
        "template": "instrumentos: {instr}",
        "variables": [{"name": "instr", "default": "", "join": " + "}],
    }
    out = ps.render_template(tpl, {"instr": ["violão", "baixo", ""]})
    assert out == "instrumentos: violão + baixo"


def test_render_prefix_suffix_only_when_filled(data_root):
    tpl = {
        "template": "base{extra}",
        "variables": [{"name": "extra", "default": "", "prefix": " — ", "suffix": "!"}],
    }
    assert ps.render_template(tpl, {"extra": ""}) == "base"
    assert ps.render_template(tpl, {"extra": "nota"}) == "base — nota!"


def test_builtin_templates_load(data_root):
    tpls = ps.list_templates()
    ids = {t["id"] for t in tpls}
    assert "style-meta-v1" in ids
    assert "lyrics-meta-v1" in ids
    assert all(t["builtin"] for t in tpls if t["id"].endswith("-v1"))


def test_render_real_style_template(data_root):
    tpl = ps.get_template("style-meta-v1")
    out = ps.render_template(tpl, {"musica": "Minha Ref", "artista": "Fulano"})
    assert "Minha Ref" in out and "Fulano" in out
    assert "{musica}" not in out and "{extras}" not in out


def test_meta_tags_catalog_has_tiers(data_root):
    tags = ps.list_meta_tags()
    assert len(tags) > 20
    tiers = {t["tier"] for t in tags}
    assert 1 in tiers and 4 in tiers  # inclui placebo (tier 4)
    chorus = next(t for t in tags if t["id"] == "chorus")
    assert chorus["tag"] == "[Chorus]"


def test_user_meta_tag_crud(data_root):
    ps.add_user_meta_tag({"id": "meu", "tag": "[Meu Tag]", "category": "vocal", "tier": 2,
                          "description_key": "x"})
    ids = {t["id"] for t in ps.list_meta_tags()}
    assert "meu" in ids
    ps.delete_user_meta_tag("meu")
    ids = {t["id"] for t in ps.list_meta_tags()}
    assert "meu" not in ids
