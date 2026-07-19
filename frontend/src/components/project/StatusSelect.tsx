import { useTranslation } from "react-i18next";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_DOT_CLASS, STATUS_ORDER } from "@/lib/status";
import type { ProjectStatus } from "@/api/types";

export function StatusSelect({
  value,
  onChange,
}: {
  value: ProjectStatus;
  onChange: (status: ProjectStatus) => void;
}) {
  const { t } = useTranslation();

  return (
    <Select value={value} onValueChange={(v) => onChange(v as ProjectStatus)}>
      <SelectTrigger className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_ORDER.map((status) => (
          <SelectItem key={status} value={status}>
            <span className="flex items-center gap-2">
              <span className={`size-1.5 rounded-full ${STATUS_DOT_CLASS[status]}`} />
              {t(`status.${status}`)}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
