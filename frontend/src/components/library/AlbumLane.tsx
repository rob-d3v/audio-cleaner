import { useTranslation } from "react-i18next";
import { Disc3, Trash2 } from "lucide-react";

import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ProjectCard } from "@/components/library/ProjectCard";
import { useDeleteAlbum } from "@/api/hooks/useAlbums";
import type { Album, Project } from "@/api/types";

export function AlbumLane({ album, projects }: { album: Album; projects: Project[] }) {
  const { t } = useTranslation();
  const deleteAlbum = useDeleteAlbum();

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Disc3 className="size-4 text-muted-foreground" />
          <h3 className="font-heading text-sm font-semibold text-foreground">
            {album.name || t("library.album.untitled")}
          </h3>
          <span className="text-xs text-muted-foreground">
            {t("library.album.members_count", { count: projects.length })}
          </span>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-alert">
              <Trash2 />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("library.album.delete_confirm_title")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("library.album.delete_confirm_description", { name: album.name || t("library.album.untitled") })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-alert text-alert-foreground hover:bg-alert/90"
                onClick={() => deleteAlbum.mutate(album.id)}
              >
                {t("common.delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {projects.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          {t("library.album.empty")}
        </p>
      ) : (
        <ScrollArea className="pb-2">
          <div className="flex gap-3">
            {projects.map((project) => (
              <div key={project.id} className="w-40 shrink-0">
                <ProjectCard project={project} />
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
    </section>
  );
}
