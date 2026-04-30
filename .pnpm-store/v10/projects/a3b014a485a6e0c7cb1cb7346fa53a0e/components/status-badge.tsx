import { cn } from "@/lib/utils";
import type { RequestStatus } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/helpers";

const STATUS_STYLES: Record<RequestStatus, string> = {
  submitted:
    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  in_review:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  approved:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  rejected:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
};

interface StatusBadgeProps {
  status: RequestStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        STATUS_STYLES[status],
        className
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", {
          "bg-blue-500": status === "submitted",
          "bg-amber-500": status === "in_review",
          "bg-emerald-500": status === "approved",
          "bg-red-500": status === "rejected",
        })}
        aria-hidden="true"
      />
      {STATUS_LABELS[status]}
    </span>
  );
}
