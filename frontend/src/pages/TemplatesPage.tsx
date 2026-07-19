import { useTranslation } from "react-i18next";
import { Lock, Plus, Trash2 } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
import { EmptyState } from "@/components/shared/EmptyState";
import { TemplateEditorDialog } from "@/components/templates/TemplateEditorDialog";
import { MetaTagManager } from "@/components/templates/MetaTagManager";
import { useDeletePromptTemplate, usePromptTemplates } from "@/api/hooks/useTemplates";

function TemplateList() {
  const { t } = useTranslation();
  const templatesQuery = usePromptTemplates();
  const deleteTemplate = useDeletePromptTemplate();
  const templates = templatesQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{t("templates.subtitle")}</p>
        <TemplateEditorDialog
          defaultKind="style"
          trigger={
            <Button size="sm">
              <Plus /> {t("templates.new_template")}
            </Button>
          }
        />
      </div>

      {templates.length === 0 ? (
        <EmptyState title={t("templates.empty")} />
      ) : (
        <div className="space-y-1.5">
          {templates.map((tpl) => (
            <div key={tpl.id} className="flex items-center justify-between gap-3 rounded-lg bg-card px-3 py-2.5 ring-1 ring-foreground/10">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{tpl.name}</p>
                  <Badge variant="outline" className="text-[10px]">
                    {t(`templates.kind.${tpl.kind}`)}
                  </Badge>
                  {tpl.builtin && (
                    <Badge variant="outline" className="gap-1 text-[10px]">
                      <Lock className="size-2.5" /> {t("common.builtin")}
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{tpl.template}</p>
              </div>
              {!tpl.builtin && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon-sm" className="shrink-0 text-muted-foreground hover:text-alert">
                      <Trash2 />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("templates.delete_confirm_title", { name: tpl.name })}</AlertDialogTitle>
                      <AlertDialogDescription>{t("templates.delete_confirm_description")}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-alert text-alert-foreground hover:bg-alert/90"
                        onClick={() => deleteTemplate.mutate(tpl.id)}
                      >
                        {t("common.delete")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TemplatesPage() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 lg:p-8">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">{t("templates.title")}</h1>
      </header>

      <Tabs defaultValue="prompts">
        <TabsList>
          <TabsTrigger value="prompts">{t("templates.tabs.prompts")}</TabsTrigger>
          <TabsTrigger value="metatags">{t("templates.tabs.metatags")}</TabsTrigger>
        </TabsList>
        <TabsContent value="prompts">
          <TemplateList />
        </TabsContent>
        <TabsContent value="metatags">
          <MetaTagManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
