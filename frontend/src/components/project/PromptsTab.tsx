import { PromptPanel } from "@/components/prompts/PromptPanel";

export function PromptsTab({ projectId }: { projectId: string }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <PromptPanel
        projectId={projectId}
        promptKind="style"
        templateKind="style"
        titleKey="project.prompts.style_title"
      />
      <PromptPanel
        projectId={projectId}
        promptKind="lyrics_prompt"
        templateKind="lyrics"
        titleKey="project.prompts.lyrics_title"
      />
    </div>
  );
}
