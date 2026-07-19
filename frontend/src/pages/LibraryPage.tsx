import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LayoutGrid, ListMusic, Plus, Search } from "lucide-react";
import { Link } from "react-router-dom";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ProjectCard } from "@/components/library/ProjectCard";
import { StatusFilterChips } from "@/components/library/StatusFilterChips";
import { NewProjectDialog } from "@/components/library/NewProjectDialog";
import { NewAlbumDialog } from "@/components/library/NewAlbumDialog";
import { AlbumLane } from "@/components/library/AlbumLane";
import { useProjects } from "@/api/hooks/useProjects";
import { useAlbums } from "@/api/hooks/useAlbums";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { ProjectStatus } from "@/api/types";

function ProjectGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export default function LibraryPage() {
  const { t } = useTranslation();
  const [view, setView] = useState<"grid" | "albums">("grid");
  const [status, setStatus] = useState<ProjectStatus | "all">("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  const projectsQuery = useProjects({ status, q: debouncedSearch || undefined });
  const albumsQuery = useAlbums();
  const allProjectsQuery = useProjects({});

  const projects = projectsQuery.data ?? [];
  const hasAnyProjects = (allProjectsQuery.data?.length ?? 0) > 0;
  const isFiltered = status !== "all" || debouncedSearch.length > 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
            {t("library.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("library.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {view === "albums" && (
            <NewAlbumDialog
              trigger={
                <Button variant="outline">
                  <Plus /> {t("library.new_album")}
                </Button>
              }
            />
          )}
          <Button onClick={() => setNewProjectOpen(true)}>
            <Plus /> {t("library.new_project")}
          </Button>
          <NewProjectDialog open={newProjectOpen} onOpenChange={setNewProjectOpen} />
        </div>
      </header>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("library.search_placeholder")}
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-3">
          {view === "grid" && <StatusFilterChips value={status} onChange={setStatus} />}
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(v) => v && setView(v as "grid" | "albums")}
            variant="outline"
          >
            <ToggleGroupItem value="grid" aria-label={t("library.view.grid")}>
              <LayoutGrid className="size-3.5" />
              {t("library.view.grid")}
            </ToggleGroupItem>
            <ToggleGroupItem value="albums" aria-label={t("library.view.albums")}>
              <ListMusic className="size-3.5" />
              {t("library.view.albums")}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {view === "grid" ? (
        projectsQuery.isLoading ? (
          <ProjectGridSkeleton />
        ) : projects.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : hasAnyProjects || isFiltered ? (
          <EmptyState
            title={t("library.no_results.title")}
            description={t("library.no_results.description")}
          />
        ) : (
          <EmptyState
            title={t("library.empty.title")}
            description={t("library.empty.description")}
            action={
              <>
                <Button variant="outline" asChild>
                  <Link to="/import">{t("library.empty.cta_import")}</Link>
                </Button>
                <Button onClick={() => setNewProjectOpen(true)}>{t("library.empty.cta_new")}</Button>
              </>
            }
          />
        )
      ) : (
        <div className="space-y-8">
          {(albumsQuery.data ?? []).map((album) => (
            <AlbumLane
              key={album.id}
              album={album}
              projects={(allProjectsQuery.data ?? []).filter((p) => p.album_id === album.id)}
            />
          ))}
          {albumsQuery.data?.length === 0 && (
            <EmptyState
              title={t("library.empty.title")}
              description={t("library.empty.description")}
              action={
                <NewAlbumDialog
                  trigger={
                    <Button>
                      <Plus /> {t("library.new_album")}
                    </Button>
                  }
                />
              }
            />
          )}
        </div>
      )}
    </div>
  );
}
