import type { ProjectStatus } from "@/api/types";

export const STATUS_ORDER: ProjectStatus[] = ["idea", "em_progresso", "quase", "pronto"];

/** Badge classes per status — reuses the signal/caution palette so the
 * progression (idea -> in progress -> almost -> ready) visually tracks the
 * same "signal getting stronger" language as the level meter. */
export const STATUS_BADGE_CLASS: Record<ProjectStatus, string> = {
  idea: "bg-muted text-muted-foreground border-transparent",
  em_progresso: "bg-caution/15 text-caution border-transparent",
  quase: "bg-transparent text-primary border-primary/40",
  pronto: "bg-primary text-primary-foreground border-transparent",
};

export const STATUS_DOT_CLASS: Record<ProjectStatus, string> = {
  idea: "bg-muted-foreground/50",
  em_progresso: "bg-caution",
  quase: "bg-primary/60",
  pronto: "bg-primary",
};
