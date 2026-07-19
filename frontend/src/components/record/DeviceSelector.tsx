import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDevices } from "@/api/hooks/useDevices";

export function DeviceSelector({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (deviceId: number) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const devicesQuery = useDevices();
  const devices = devicesQuery.data ?? [];

  return (
    <div className="space-y-1.5">
      <Label>{t("record.device_label")}</Label>
      <Select
        value={value !== null ? String(value) : undefined}
        onValueChange={(v) => onChange(Number(v))}
        disabled={disabled}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t("record.device_placeholder")} />
        </SelectTrigger>
        <SelectContent>
          {devices.length === 0 && (
            <div className="p-2 text-xs text-muted-foreground">{t("record.device_empty")}</div>
          )}
          {devices.map((device) => (
            <SelectItem key={device.id} value={String(device.id)}>
              <span className="flex items-center gap-1.5">
                <span className="truncate">{device.name}</span>
                {device.is_default && (
                  <Badge variant="outline" className="h-4 px-1 text-[9px]">
                    {t("record.device_default_badge")}
                  </Badge>
                )}
                {device.hostapi_preferred && (
                  <Badge variant="outline" className="h-4 border-primary/30 px-1 text-[9px] text-primary">
                    {t("record.device_wasapi_badge")}
                  </Badge>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
