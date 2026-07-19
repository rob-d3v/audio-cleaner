import { useTranslation } from "react-i18next";
import { AlertTriangle, FolderSearch } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DEFAULT_PATH = "E:\\Robbs\\Pride\\Music\\ROBBS";

export function PathStep({
  path,
  onPathChange,
  onScan,
  scanning,
  recentPaths,
  ffmpegWarning,
}: {
  path: string;
  onPathChange: (path: string) => void;
  onScan: () => void;
  scanning: boolean;
  recentPaths: string[];
  ffmpegWarning: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">{t("import.step1.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("import.step1.description")}</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="import-path">{t("import.step1.path_label")}</Label>
        <Input
          id="import-path"
          value={path}
          onChange={(e) => onPathChange(e.target.value)}
          placeholder={DEFAULT_PATH}
          className="font-numeric"
          onKeyDown={(e) => {
            if (e.key === "Enter" && path.trim() && !scanning) onScan();
          }}
        />
      </div>

      {recentPaths.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t("import.step1.recent_label")}</Label>
          <div className="flex flex-wrap gap-1.5">
            {recentPaths.map((recent) => (
              <button
                key={recent}
                type="button"
                onClick={() => onPathChange(recent)}
                className="rounded-full border border-border px-2.5 py-1 font-numeric text-xs text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              >
                {recent}
              </button>
            ))}
          </div>
        </div>
      )}

      {ffmpegWarning && (
        <div className="flex items-start gap-2 rounded-lg border border-caution/30 bg-caution/10 p-3 text-xs text-caution">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {t("import.step1.ffmpeg_warning")}
        </div>
      )}

      <Button onClick={onScan} disabled={!path.trim() || scanning}>
        <FolderSearch /> {scanning ? t("import.step1.scanning") : t("import.step1.scan_button")}
      </Button>
    </div>
  );
}
