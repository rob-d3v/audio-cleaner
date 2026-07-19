import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PathStep } from "@/components/importer/PathStep";
import { ReviewTable } from "@/components/importer/ReviewTable";
import { ExecuteStep } from "@/components/importer/ExecuteStep";
import { useImportExecute, useImportScan } from "@/api/hooks/useImport";
import { useAlbums } from "@/api/hooks/useAlbums";
import { ApiError } from "@/api/client";
import { tFallback } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { wizardItemFromScan, type WizardItem } from "@/components/importer/types";
import type { ImportScanResult } from "@/api/types";

const DEFAULT_PATH = "E:\\Robbs\\Pride\\Music\\ROBBS";
const RECENT_PATHS_KEY = "ac-import-recent-paths";
const MAX_RECENT_PATHS = 5;

function loadRecentPaths(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_PATHS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string") : [];
  } catch {
    return [];
  }
}

function saveRecentPath(path: string) {
  const current = loadRecentPaths().filter((p) => p !== path);
  const next = [path, ...current].slice(0, MAX_RECENT_PATHS);
  window.localStorage.setItem(RECENT_PATHS_KEY, JSON.stringify(next));
  return next;
}

const STEP_KEYS = ["step1", "step2", "step3"] as const;

export default function ImportWizardPage() {
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [path, setPath] = useState(DEFAULT_PATH);
  const [recentPaths, setRecentPaths] = useState<string[]>(() => loadRecentPaths());
  const [scanResult, setScanResult] = useState<ImportScanResult | null>(null);
  const [items, setItems] = useState<WizardItem[]>([]);
  const [copyOriginals, setCopyOriginals] = useState(true);
  const [executeJobId, setExecuteJobId] = useState<string | undefined>();

  const scanMutation = useImportScan();
  const executeMutation = useImportExecute();
  const albumsQuery = useAlbums();

  const handleError = (err: unknown) => {
    const message = err instanceof ApiError ? tFallback(t, err.messageKey) : t("errors.unknown");
    toast.error(message);
  };

  const handleScan = () => {
    scanMutation.mutate(
      { path },
      {
        onSuccess: (result) => {
          setScanResult(result);
          setItems(result.items.map(wizardItemFromScan));
          setRecentPaths(saveRecentPath(path));
          setStep(2);
        },
        onError: handleError,
      },
    );
  };

  const handleItemChange = (key: string, patch: Partial<WizardItem>) => {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  };

  const handleExecute = () => {
    const selected = items.filter((item) => item.selected);
    executeMutation.mutate(
      {
        copy_originals: copyOriginals,
        items: selected.map((item) => ({
          folder: item.folder,
          name: item.name,
          status: item.status,
          include_audio: item.includedAudio,
          lyrics_file: item.lyricsFile,
          cover_file: item.coverFile,
          album_id: item.albumId,
        })),
      },
      {
        onSuccess: (res) => setExecuteJobId(res.job_id),
        onError: handleError,
      },
    );
  };

  const selectedCount = items.filter((i) => i.selected).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 lg:p-8">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">{t("import.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("import.subtitle")}</p>
      </header>

      <div className="flex items-center gap-2">
        {STEP_KEYS.map((key, idx) => {
          const n = (idx + 1) as 1 | 2 | 3;
          const isActive = step === n;
          const isDone = step > n;
          return (
            <div key={key} className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full font-numeric text-xs font-medium",
                  isActive && "bg-primary text-primary-foreground",
                  isDone && !isActive && "bg-primary/20 text-primary",
                  !isActive && !isDone && "bg-muted text-muted-foreground",
                )}
              >
                {n}
              </span>
              <span className={cn("text-sm", isActive ? "text-foreground" : "text-muted-foreground")}>
                {t(`import.${key}.title`)}
              </span>
              {idx < STEP_KEYS.length - 1 && <ChevronRight className="size-3.5 text-muted-foreground/50" />}
            </div>
          );
        })}
      </div>

      {step === 1 && (
        <PathStep
          path={path}
          onPathChange={setPath}
          onScan={handleScan}
          scanning={scanMutation.isPending}
          recentPaths={recentPaths}
          ffmpegWarning={scanResult ? !scanResult.ffmpeg_available : false}
        />
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground">{t("import.step2.title")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("import.step2.description")}</p>
          </div>
          {scanResult && !scanResult.ffmpeg_available && (
            <p className="text-xs text-caution">{t("import.step1.ffmpeg_warning")}</p>
          )}
          <div className="overflow-hidden rounded-xl border border-border">
            <ReviewTable items={items} onChange={handleItemChange} albums={albumsQuery.data ?? []} />
          </div>
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ChevronLeft /> {t("common.back")}
            </Button>
            <Button onClick={() => setStep(3)} disabled={selectedCount === 0}>
              {t("common.next")} <ChevronRight />
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <ExecuteStep
            itemCount={selectedCount}
            copyOriginals={copyOriginals}
            onCopyOriginalsChange={setCopyOriginals}
            jobId={executeJobId}
            onExecute={handleExecute}
            executing={executeMutation.isPending}
          />
          {!executeJobId && (
            <Button variant="outline" onClick={() => setStep(2)}>
              <ChevronLeft /> {t("common.back")}
            </Button>
          )}
          {executeJobId && (
            <Button
              variant="outline"
              onClick={() => {
                setStep(1);
                setScanResult(null);
                setItems([]);
                setExecuteJobId(undefined);
                setPath(DEFAULT_PATH);
              }}
            >
              {t("import.step3.start_over")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
