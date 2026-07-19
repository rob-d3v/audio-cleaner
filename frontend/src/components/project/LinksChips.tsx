import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePatchProject } from "@/api/hooks/useProjects";
import type { Project, ProjectLink } from "@/api/types";

function newLinkId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `link-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function LinksChips({ project }: { project: Project }) {
  const { t } = useTranslation();
  const patchProject = usePatchProject(project.id);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("");
  const [label, setLabel] = useState("");
  const [target, setTarget] = useState("");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!target.trim()) return;
    const link: ProjectLink = {
      id: newLinkId(),
      type: type.trim() || "link",
      label: label.trim() || target.trim(),
      target: target.trim(),
    };
    patchProject.mutate(
      { links: [...project.links, link] },
      {
        onSuccess: () => {
          setOpen(false);
          setType("");
          setLabel("");
          setTarget("");
        },
      },
    );
  };

  const handleRemove = (id: string) => {
    patchProject.mutate({ links: project.links.filter((l) => l.id !== id) });
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {project.links.map((link) => (
        <span
          key={link.id}
          className="group/link inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 py-0.5 pr-1 pl-2 text-xs text-foreground"
        >
          <a href={link.target} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-primary">
            <ExternalLink className="size-3" />
            {link.label}
          </a>
          <button
            type="button"
            onClick={() => handleRemove(link.id)}
            className="rounded-full p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover/link:opacity-100 hover:text-alert"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs text-muted-foreground">
            <Plus className="size-3" /> {t("project.header.add_link")}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <form onSubmit={handleAdd}>
            <DialogHeader>
              <DialogTitle>{t("project.header.add_link")}</DialogTitle>
            </DialogHeader>
            <div className="mt-4 space-y-3">
              <div className="space-y-1">
                <Label>{t("common.name")}</Label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Suno" />
              </div>
              <div className="space-y-1">
                <Label>URL</Label>
                <Input
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="https://…"
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <Label>{t("common.type")}</Label>
                <Input value={type} onChange={(e) => setType(e.target.value)} placeholder="suno / drive / other" />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={!target.trim() || patchProject.isPending}>
                {t("common.add")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
