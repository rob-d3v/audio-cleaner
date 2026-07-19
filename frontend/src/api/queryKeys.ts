// Central query-key factory so every hook and every invalidation call
// agrees on the same key shapes.
export const queryKeys = {
  systemInfo: ["system", "info"] as const,
  systemCapabilities: ["system", "capabilities"] as const,
  devices: ["devices"] as const,
  projects: (filters?: { status?: string; album_id?: string; q?: string }) =>
    ["projects", filters ?? {}] as const,
  project: (id: string) => ["projects", id] as const,
  projectCover: (id: string, updatedAt?: string) => ["projects", id, "cover", updatedAt] as const,
  notes: (projectId: string) => ["projects", projectId, "notes"] as const,
  lyrics: (projectId: string) => ["projects", projectId, "lyrics"] as const,
  lyricsVersions: (projectId: string) => ["projects", projectId, "lyrics", "versions"] as const,
  lyricsVersion: (projectId: string, ts: number) =>
    ["projects", projectId, "lyrics", "versions", ts] as const,
  prompts: (projectId: string) => ["projects", projectId, "prompts"] as const,
  promptHistory: (projectId: string, kind: string) =>
    ["projects", projectId, "prompts", kind, "history"] as const,
  albums: ["albums"] as const,
  album: (id: string) => ["albums", id] as const,
  takes: (projectId: string) => ["projects", projectId, "takes"] as const,
  take: (id: string) => ["takes", id] as const,
  pipelineStages: ["pipeline", "stages"] as const,
  presets: ["presets"] as const,
  promptTemplates: (kind?: string) => ["prompt-templates", kind ?? "all"] as const,
  metaTags: ["meta-tags"] as const,
  job: (id: string) => ["jobs", id] as const,
  scripts: ["scripts"] as const,
  script: (id: string) => ["scripts", id] as const,
  takeStems: (takeId: string) => ["takes", takeId, "stems"] as const,
};
