import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { ImagePlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { projectCoverUrl, useDeleteProjectCover, useUploadProjectCover } from "@/api/hooks/useProjects";
import { cn } from "@/lib/utils";
import type { Project } from "@/api/types";

export function CoverUploader({ project }: { project: Project }) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadCover = useUploadProjectCover(project.id);
  const deleteCover = useDeleteProjectCover(project.id);

  return (
    <div className="group/cover relative size-28 shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10 sm:size-32">
      {project.cover ? (
        <img
          src={projectCoverUrl(project.id, project.updated_at)}
          alt=""
          className="size-full object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center bg-grain bg-gradient-to-br from-primary/20 via-card to-card">
          <ImagePlus className="size-6 text-foreground/25" />
        </div>
      )}
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center gap-1.5 bg-background/70 opacity-0 backdrop-blur-sm transition-opacity group-hover/cover:opacity-100",
        )}
      >
        <Button
          type="button"
          size="icon-sm"
          variant="secondary"
          title={t("project.header.cover_upload")}
          onClick={() => inputRef.current?.click()}
          disabled={uploadCover.isPending}
        >
          <ImagePlus />
        </Button>
        {project.cover && (
          <Button
            type="button"
            size="icon-sm"
            variant="secondary"
            title={t("project.header.cover_remove")}
            onClick={() => deleteCover.mutate()}
            disabled={deleteCover.isPending}
          >
            <X />
          </Button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadCover.mutate(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
