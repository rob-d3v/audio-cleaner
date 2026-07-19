import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

export function RatingStars({
  value,
  onChange,
  max = 5,
  readOnly = false,
  className,
}: {
  value: number;
  onChange?: (rating: number) => void;
  max?: number;
  readOnly?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(star === value ? 0 : star)}
          className={cn(
            "text-muted-foreground/40 transition-colors",
            !readOnly && "hover:text-caution",
            star <= value && "text-caution",
          )}
          aria-label={`${star}`}
        >
          <Star className={cn("size-3.5", star <= value && "fill-current")} />
        </button>
      ))}
    </div>
  );
}
