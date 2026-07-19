// Shared API types for the Audio Cleaner backend.
// Kept intentionally close to the backend's JSON shapes — one file, no drift.

export type ProjectStatus = "idea" | "em_progresso" | "quase" | "pronto";
export type ProjectMode = "voice" | "voice_guitar";
export type TakeOrigin = "recorded" | "imported";
export type JobStatus = "queued" | "running" | "done" | "error" | "cancelled";
export type StageCategory = string;

export interface ApiErrorBody {
  error: {
    code: string;
    message_key: string;
    detail?: string;
  };
}

export interface ProjectLink {
  id: string;
  type: string;
  label: string;
  target: string;
}

export interface ImportInfo {
  source_path?: string;
  imported_at?: string;
  [key: string]: unknown;
}

export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  mode: ProjectMode;
  created_at: string;
  updated_at: string;
  album_id: string | null;
  track_hint: number | null;
  best_take_id: string | null;
  cover: boolean;
  links: ProjectLink[];
  import_info: ImportInfo | null;
  take_count?: number;
}

export interface Album {
  id: string;
  name: string;
  project_ids: string[];
  cover_project_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcessedVariant {
  chain_hash: string;
  chain: PipelineChain;
  created_at: string;
}

export interface Take {
  id: string;
  project_id: string;
  created_at: string;
  duration_s: number;
  sample_rate: number;
  channels: number;
  rating: number;
  notes: string;
  origin: TakeOrigin;
  processed: ProcessedVariant[];
  session_label: string | null;
}

export interface SystemInfo {
  version: string;
  data_dir: string;
  ffmpeg: boolean;
}

export interface SystemCapabilities {
  denoise: boolean;
  quality: boolean;
  separate: boolean;
  ffmpeg: boolean;
  gpu: {
    torch_cuda: boolean;
    ort_providers: string[];
  };
}

export interface AudioDevice {
  id: number;
  name: string;
  hostapi_name: string;
  max_input_channels: number;
  default_samplerate: number;
  is_default: boolean;
  hostapi_preferred: boolean;
}

export type ParamSchemaType = "number" | "integer" | "boolean" | "string";

export interface ParamSchemaProperty {
  type: ParamSchemaType;
  title?: string;
  description?: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  multipleOf?: number;
  enum?: (string | number)[];
  "x-enum-labels"?: Record<string, string>;
}

export interface ParamsSchema {
  type: "object";
  properties: Record<string, ParamSchemaProperty>;
  required?: string[];
}

export interface PipelineStage {
  id: string;
  name_key: string;
  category: StageCategory;
  params_schema: ParamsSchema;
  defaults: Record<string, unknown>;
  requires?: string[];
  available: boolean;
}

export interface PipelineStageConfig {
  id: string;
  enabled: boolean;
  params: Record<string, unknown>;
}

export interface PipelineChain {
  stages: PipelineStageConfig[];
}

export interface Preset {
  id: string;
  builtin: boolean;
  name_key: string;
  chain: PipelineChain;
  export?: {
    format?: string;
    lufs_target?: number;
    [key: string]: unknown;
  };
}

export interface PromptTemplateVariable {
  name: string;
  label_key: string;
  type: "string" | "select" | "multiselect" | "number" | "boolean";
  options?: { value: string; label_key?: string }[] | string[];
  default?: unknown;
  join?: string;
  prefix?: string;
  suffix?: string;
  required?: boolean;
}

export type PromptTemplateKind = "style" | "lyrics";

export interface PromptTemplate {
  id: string;
  builtin: boolean;
  kind: PromptTemplateKind;
  name: string;
  template: string;
  variables: PromptTemplateVariable[];
}

export type MetaTagTier = 1 | 2 | 3 | 4;

export interface MetaTag {
  id: string;
  tag: string;
  category: string;
  tier: MetaTagTier;
  description_key: string;
  builtin: boolean;
}

export type PromptKind = "style" | "lyrics_prompt";

export interface ProjectPromptState {
  current: string;
  history_count: number;
}

export interface ProjectPrompts {
  style: ProjectPromptState;
  lyrics_prompt: ProjectPromptState;
}

export interface PromptHistoryEntry {
  ts: number;
  created_at: string;
  text: string;
}

export interface LyricsState {
  text: string;
  updated_at: string | null;
  version_count: number;
}

export interface LyricsVersion {
  ts: number;
  created_at: string;
  bytes: number;
  preview: string;
}

export interface NotesState {
  text: string;
}

export interface ImportAudioFile {
  file: string;
  format: string;
  size_mb: number;
  mtime: string;
  needs_transcode: boolean;
  suggested_take_name: string;
}

export interface ImportLyricsFile {
  file: string;
  bytes: number;
  preview: string;
}

export interface ImportLinkFile {
  file: string;
  type: string;
  url: string;
}

export interface ImportAssetFile {
  file: string;
  type: string;
  path: string;
}

export interface ImportScanItem {
  folder: string;
  name_raw: string;
  suggested_name: string;
  markers: string[];
  suggested_status: ProjectStatus;
  track_hint: number | null;
  audio: ImportAudioFile[];
  lyrics: ImportLyricsFile[];
  links: ImportLinkFile[];
  assets: ImportAssetFile[];
  cover: string | null;
  warnings: string[];
}

export interface ImportScanResult {
  root: string;
  scanned_folders: number;
  items: ImportScanItem[];
  unmatched_files: string[];
  ffmpeg_available: boolean;
}

export interface ImportExecuteItem {
  folder: string;
  name: string;
  status: ProjectStatus;
  include_audio: string[];
  lyrics_file: string | null;
  cover_file: string | null;
  album_id?: string | null;
}

export interface ImportExecutePayload {
  items: ImportExecuteItem[];
  copy_originals: boolean;
}

export interface Job<TResult = unknown> {
  id: string;
  kind: string;
  status: JobStatus;
  progress: number;
  stage: string | null;
  message_key: string | null;
  result: TResult | null;
  error: { code: string; message_key: string; detail?: string } | null;
}

export interface ExportRequest {
  variant: string;
  preset?: string;
  format: string;
  range_start_s?: number;
  range_end_s?: number;
}

export interface JobRef {
  job_id: string;
}

// ---- Phase-3: guided recording scripts (roteiros) ----

export interface ScriptStep {
  id: string;
  name_key: string;
  duration_s: number;
  instruction_key: string;
  record: boolean;
  bars?: string;
}

export interface RecordingScript {
  id: string;
  name_key: string;
  description_key: string;
  target_total_min: number;
  steps: ScriptStep[];
}

// ---- Phase-3: best-2-min helper ----

export interface BestTwoMinWindow {
  start_s: number;
  score: number;
}

export interface BestTwoMinResult {
  start_s: number;
  end_s: number;
  score: number;
  per_window: BestTwoMinWindow[];
}

// ---- Phase-3: stems (voice/guitar separation) ----

export interface TakeStems {
  take_id: string;
  model: string;
  stems: {
    vocals: string;
    instrumental: string;
  };
}

// ---- WebSocket message types ----

export interface WsJobMessage {
  type: "job";
  id: string;
  kind: string;
  status: JobStatus;
  progress: number;
  stage: string | null;
  message_key: string | null;
  result: unknown;
  error: { code: string; message_key: string; detail?: string } | null;
}

export interface WsMeterMessage {
  type: "meter";
  t: number;
  rms_db: number;
  peak_db: number;
  peak_hold_db: number;
  clip: boolean;
}

export interface WsRecordStateMessage {
  type: "record_state";
  state: "idle" | "monitoring" | "recording" | "stopped";
  take_id: string | null;
  elapsed_s: number;
}

export interface WsErrorMessage {
  type: "error";
  code: string;
}

export type WsMeterChannelMessage =
  | WsMeterMessage
  | WsRecordStateMessage
  | WsErrorMessage;
