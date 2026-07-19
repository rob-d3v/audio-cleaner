import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowLeft, Guitar, Mic } from "lucide-react";

import { CoverUploader } from "@/components/project/CoverUploader";
import { StatusSelect } from "@/components/project/StatusSelect";
import { LinksChips } from "@/components/project/LinksChips";
import { usePatchProject } from "@/api/hooks/useProjects";
import type { Project, ProjectStatus } from "@/api/types";

export function ProjectHeader({ project }: { project: Project }) {
  const { t } = useTranslation();
  const patchProject = usePatchProject(project.id);
  const [name, setName] = useState(project.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setName(project.name), [project.name]);

  const commitName = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== project.name) {
      patchProject.mutate({ name: trimmed });
    } else {
      setName(project.name);
    }
  };

  return (
    <header className="space-y-4">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> {t("project.back_to_library")}
      </Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <CoverUploader project={project} />
        <div className="min-w-0 flex-1 space-y-2">
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") inputRef.current?.blur();
              if (e.key === "Escape") setName(project.name);
            }}
            placeholder={t("project.header.name_placeholder")}
            className="w-full rounded-md border border-transparent bg-transparent font-heading text-2xl font-semibold tracking-tight text-foreground outline-none transition-colors hover:border-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <div className="flex flex-wrap items-center gap-3">
            <StatusSelect
              value={project.status}
              onChange={(status: ProjectStatus) => patchProject.mutate({ status })}
            />
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              {project.mode === "voice_guitar" ? <Guitar className="size-3.5" /> : <Mic className="size-3.5" />}
              {t(`project.header.mode.${project.mode}`)}
            </span>
          </div>
          <LinksChips project={project} />
        </div>
      </div>
    </header>
  );
}
