import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Cpu, Info, Languages, Moon, Sliders, Sun } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import { useSystemCapabilities, useSystemInfo } from "@/api/hooks/useSystem";
import { useTheme } from "@/components/theme-provider";
import { changeAppLanguage } from "@/i18n";
import { LANGUAGES } from "@/i18n/languages";

const LUFS_STORAGE_KEY = "ac-default-lufs";
const DEFAULT_LUFS = -14;

function SettingsSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <h2 className="flex items-center gap-2 font-heading text-sm font-semibold text-foreground">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-numeric text-foreground">{value}</span>
    </div>
  );
}

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const systemInfoQuery = useSystemInfo();
  const capabilitiesQuery = useSystemCapabilities();

  const [lufs, setLufs] = useState<string>(() => {
    if (typeof window === "undefined") return String(DEFAULT_LUFS);
    return window.localStorage.getItem(LUFS_STORAGE_KEY) ?? String(DEFAULT_LUFS);
  });

  useEffect(() => {
    const handle = setTimeout(() => {
      window.localStorage.setItem(LUFS_STORAGE_KEY, lufs);
    }, 500);
    return () => clearTimeout(handle);
  }, [lufs]);

  const handleLanguageChange = (lang: string) => {
    void changeAppLanguage(lang);
  };

  const info = systemInfoQuery.data;
  const capabilities = capabilitiesQuery.data;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 lg:p-8">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">{t("settings.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("settings.subtitle")}</p>
      </header>

      <SettingsSection icon={<Info className="size-4 text-muted-foreground" />} title={t("settings.system_info_title")}>
        {systemInfoQuery.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : info ? (
          <div>
            <InfoRow label={t("settings.version")} value={info.version} />
            <InfoRow label={t("settings.data_dir")} value={<span className="truncate">{info.data_dir}</span>} />
            <InfoRow
              label={t("settings.ffmpeg_status")}
              value={
                <Badge variant="outline" className={info.ffmpeg ? "border-primary/30 text-primary" : "border-alert/30 text-alert"}>
                  {info.ffmpeg ? t("settings.ffmpeg_available") : t("settings.ffmpeg_missing")}
                </Badge>
              }
            />
          </div>
        ) : null}
      </SettingsSection>

      <SettingsSection icon={<Cpu className="size-4 text-muted-foreground" />} title={t("settings.capabilities_title")}>
        {capabilitiesQuery.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : capabilities ? (
          <div className="space-y-3">
            <div>
              {(["denoise", "quality", "separate", "ffmpeg"] as const).map((key) => (
                <InfoRow
                  key={key}
                  label={t(`settings.capability.${key}`)}
                  value={
                    <Badge
                      variant="outline"
                      className={capabilities[key] ? "border-primary/30 text-primary" : "text-muted-foreground"}
                    >
                      {capabilities[key] ? t("settings.capability_available") : t("settings.capability_unavailable")}
                    </Badge>
                  }
                />
              ))}
            </div>
            <div className="space-y-1 border-t border-border pt-3">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("settings.gpu_title")}</p>
              <InfoRow
                label={t("settings.gpu.torch_cuda")}
                value={
                  <Badge variant="outline" className={capabilities.gpu.torch_cuda ? "border-primary/30 text-primary" : "text-muted-foreground"}>
                    {capabilities.gpu.torch_cuda ? t("settings.capability_available") : t("settings.capability_unavailable")}
                  </Badge>
                }
              />
              <div className="flex items-center justify-between py-2 text-sm">
                <span className="text-muted-foreground">{t("settings.gpu.ort_providers")}</span>
                <span className="font-numeric text-right text-foreground">
                  {capabilities.gpu.ort_providers.length > 0 ? capabilities.gpu.ort_providers.join(", ") : t("settings.gpu_none")}
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </SettingsSection>

      <SettingsSection icon={<Languages className="size-4 text-muted-foreground" />} title={t("settings.language_title")}>
        <Select value={i18n.language} onValueChange={handleLanguageChange}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            {LANGUAGES.map((lang) => (
              <SelectItem key={lang.code} value={lang.code}>
                {lang.nativeName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsSection>

      <SettingsSection
        icon={theme === "dark" ? <Moon className="size-4 text-muted-foreground" /> : <Sun className="size-4 text-muted-foreground" />}
        title={t("settings.theme_title")}
      >
        <ToggleGroup type="single" value={theme} onValueChange={(v) => v && setTheme(v as "dark" | "light")} variant="outline">
          <ToggleGroupItem value="dark">
            <Moon className="size-3.5" /> {t("settings.theme.dark")}
          </ToggleGroupItem>
          <ToggleGroupItem value="light">
            <Sun className="size-3.5" /> {t("settings.theme.light")}
          </ToggleGroupItem>
        </ToggleGroup>
      </SettingsSection>

      <SettingsSection icon={<Sliders className="size-4 text-muted-foreground" />} title={t("settings.defaults_title")}>
        <div className="space-y-1.5">
          <Label htmlFor="lufs-target">{t("settings.lufs_target_label")}</Label>
          <Input
            id="lufs-target"
            type="number"
            step="0.5"
            value={lufs}
            onChange={(e) => setLufs(e.target.value)}
            onBlur={() => toast.success(t("settings.saved"))}
            className="w-32 font-numeric"
          />
          <p className="text-xs text-muted-foreground">{t("settings.lufs_target_hint")}</p>
        </div>
      </SettingsSection>
    </div>
  );
}
