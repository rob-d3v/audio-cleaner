import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Guitar, Mic } from "lucide-react";

import { StatusBadge } from "@/components/shared/StatusBadge";
import { projectCoverUrl } from "@/api/hooks/useProjects";
import { formatDate } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { Project } from "@/api/types";

const GRADIENTS = [
  "from-primary/25 via-card to-card",
  "from-caution/20 via-card to-card",
  "from-alert/15 via-card to-card",
  "from-primary/15 via-card to-card",
];

function gradientFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function ProjectCard({ project }: { project: Project }) {
  const { t, i18n } = useTranslation();

  return (
    <Link
      to={`/project/${project.id}`}
      className="group/card focus-visible:ring-3 focus-visible:ring-ring/50 block overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 transition-all duration-200 hover:-translate-y-0.5 hover:ring-foreground/20 focus-visible:outline-none"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {project.cover ? (
          <img
            src={projectCoverUrl(project.id, project.updated_at)}
            alt=""
            className="size-full object-cover transition-transform duration-300 group-hover/card:scale-[1.03]"
          />
        ) : (
          <div
            className={cn(
              "flex size-full items-center justify-center bg-gradient-to-br font-heading text-3xl font-semibold text-foreground/25 bg-grain",
              gradientFor(project.id),
            )}
          >
            {initials(project.name)}
          </div>
        )}
        <div className="absolute top-2 right-2">
          <StatusBadge status={project.status} className="shadow-sm backdrop-blur-sm" />
        </div>
        <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-background/70 px-1.5 py-1 text-muted-foreground backdrop-blur-sm">
          {project.mode === "voice_guitar" ? <Guitar className="size-3.5" /> : <Mic className="size-3.5" />}
        </div>
      </div>
      <div className="space-y-1 p-3">
        <p className="truncate text-sm font-medium text-foreground">{project.name}</p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-numeric">{formatDate(project.updated_at, i18n.language)}</span>
          {typeof project.take_count === "number" && (
            <span>{t("library.take_count", { count: project.take_count })}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
