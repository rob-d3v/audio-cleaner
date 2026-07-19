"""Rotas do Prompt Studio: templates, render e catálogo de meta-tags."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Response
from pydantic import BaseModel

from app.core import prompt_studio as ps

router = APIRouter(tags=["templates"])


class RenderBody(BaseModel):
    template_id: str
    variables: dict[str, Any] = {}


@router.get("/prompt-templates")
def list_templates(kind: str | None = None) -> list[dict]:
    return ps.list_templates(kind)


@router.post("/prompt-templates", status_code=201)
def save_template(template: dict[str, Any]) -> dict:
    return ps.save_user_template(template)


@router.delete("/prompt-templates/{template_id}", status_code=204)
def delete_template(template_id: str) -> Response:
    ps.delete_user_template(template_id)
    return Response(status_code=204)


@router.post("/prompt-templates/render")
def render(body: RenderBody) -> dict:
    template = ps.get_template(body.template_id)
    return {"text": ps.render_template(template, body.variables)}


@router.get("/meta-tags")
def list_meta_tags() -> list[dict]:
    return ps.list_meta_tags()


@router.post("/meta-tags", status_code=201)
def add_meta_tag(tag: dict[str, Any]) -> dict:
    return ps.add_user_meta_tag(tag)


@router.delete("/meta-tags/{tag_id}", status_code=204)
def delete_meta_tag(tag_id: str) -> Response:
    ps.delete_user_meta_tag(tag_id)
    return Response(status_code=204)
