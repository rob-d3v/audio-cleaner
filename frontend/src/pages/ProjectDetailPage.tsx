import { useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ProjectHeader } from "@/components/project/ProjectHeader";
import { AudioTab } from "@/components/project/AudioTab";
import { LyricsTab } from "@/components/project/LyricsTab";
import { PromptsTab } from "@/components/project/PromptsTab";
import { NotesTab } from "@/components/project/NotesTab";
import { useProject } from "@/api/hooks/useProjects";

const TAB_VALUES = ["audio", "lyrics", "prompts", "notes"] as const;
type TabValue = (typeof TAB_VALUES)[number];

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectQuery = useProject(id);

  const activeTab: TabValue = TAB_VALUES.includes(searchParams.get("tab") as TabValue)
    ? (searchParams.get("tab") as TabValue)
    : "audio";

  const setActiveTab = (value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", value);
      return next;
    });
  };

  if (!id) return null;

  if (projectQuery.isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 p-6 lg:p-8">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!projectQuery.data) {
    return (
      <div className="mx-auto max-w-5xl p-6 lg:p-8">
        <EmptyState title={t("errors.project_not_found")} />
      </div>
    );
  }

  const project = projectQuery.data;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 lg:p-8">
      <ProjectHeader project={project} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="audio">{t("project.tabs.audio")}</TabsTrigger>
          <TabsTrigger value="lyrics">{t("project.tabs.lyrics")}</TabsTrigger>
          <TabsTrigger value="prompts">{t("project.tabs.prompts")}</TabsTrigger>
          <TabsTrigger value="notes">{t("project.tabs.notes")}</TabsTrigger>
        </TabsList>
        <TabsContent value="audio">
          <AudioTab projectId={project.id} mode={project.mode} />
        </TabsContent>
        <TabsContent value="lyrics">
          <LyricsTab projectId={project.id} />
        </TabsContent>
        <TabsContent value="prompts">
          <PromptsTab projectId={project.id} />
        </TabsContent>
        <TabsContent value="notes">
          <NotesTab projectId={project.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
