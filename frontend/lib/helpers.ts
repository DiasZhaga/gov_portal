import type { ServiceType, RequestStatus } from "./types";

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  birth_certificate: "Свидетельство о рождении",
  residence_certificate: "Справка о месте жительства",
  tax_clearance: "Справка об отсутствии налоговой задолженности",
};

export const STATUS_LABELS: Record<RequestStatus, string> = {
  submitted: "Отправлено",
  in_review: "На рассмотрении",
  approved: "Одобрено",
  rejected: "Отклонено",
};

export const STATUS_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  submitted: ["in_review"],
  in_review: ["approved", "rejected"],
  approved: [],
  rejected: [],
};

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
