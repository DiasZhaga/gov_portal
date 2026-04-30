"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Upload, FileUp, AlertCircle, MessageSquare } from "lucide-react";

import { citizenApi } from "@/lib/api";
import { formatDateTime, SERVICE_TYPE_LABELS } from "@/lib/helpers";
import type { ServiceRequestPublic } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

const UPLOAD_ALLOWED_STATUSES = ["submitted", "in_review"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}

export default function CitizenRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [request, setRequest] = useState<ServiceRequestPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  useEffect(() => {
    citizenApi
      .getRequest(id)
      .then(setRequest)
      .catch((err) => setError(err.message ?? "Failed to load request."))
      .finally(() => setLoading(false));
  }, [id]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);

    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setFileError(`Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileError("File size exceeds the 5 MB limit.");
      return;
    }

    setUploading(true);
    try {
      await citizenApi.uploadAttachment(id, file);
      toast.success(`"${file.name}" uploaded successfully.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const canUpload =
    request && UPLOAD_ALLOWED_STATUSES.includes(request.status);

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Skeleton className="mb-6 h-8 w-48" />
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </main>
    );
  }

  if (error || !request) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <p className="text-sm text-destructive">{error ?? "Request not found."}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      {/* Back */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.back()}
        className="mb-6 gap-1.5 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Вернуться к обращениям
      </Button>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{request.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {SERVICE_TYPE_LABELS[request.service_type]}
          </p>
        </div>
        <StatusBadge status={request.status} className="shrink-0 mt-1" />
      </div>

      <div className="space-y-4">
        {/* Request details */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Детали обращения</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-5 sm:grid-cols-2">
              <DetailItem label="Тип услуги">
                {SERVICE_TYPE_LABELS[request.service_type]}
              </DetailItem>
              <DetailItem label="Статус">
                <StatusBadge status={request.status} />
              </DetailItem>
              <DetailItem label="Отправлено">
                {formatDateTime(request.created_at)}
              </DetailItem>
              <DetailItem label="Последнее обновление">
                {formatDateTime(request.updated_at)}
              </DetailItem>
              <div className="sm:col-span-2">
                <DetailItem label="Описание">
                  <span className="whitespace-pre-wrap leading-relaxed">{request.description}</span>
                </DetailItem>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Public comment */}
        {request.public_comment && (
          <Card className="shadow-sm border-blue-200 bg-blue-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-blue-800">
                <MessageSquare className="h-4 w-4" />
                Комментарий оператора
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-blue-900 leading-relaxed">{request.public_comment}</p>
            </CardContent>
          </Card>
        )}

        {/* Attachment upload */}
        {canUpload && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Приложить вспомогательные документы</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">
                Поддерживаемые форматы: PDF, JPG, JPEG, PNG. Максимальный размер файла: 5 МБ.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                id="file-upload"
                accept=".pdf,.jpg,.jpeg,.png"
                className="sr-only"
                onChange={handleFileChange}
                disabled={uploading}
                aria-label="Upload attachment"
              />
              <label htmlFor="file-upload">
                <Button
                  asChild
                  variant="outline"
                  disabled={uploading}
                  className="cursor-pointer gap-2"
                >
                  <span>
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {uploading ? "Загрузка..." : "Выбрать файл"}
                  </span>
                </Button>
              </label>
              {fileError && (
                <p className="mt-2 text-xs text-destructive">{fileError}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Upload not available notice */}
        {!canUpload && (request.status === "approved" || request.status === "rejected") && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            <FileUp className="h-4 w-4 shrink-0" />
            Загрузка документов недоступна для обращений со статусом {request.status}.
          </div>
        )}
      </div>
    </main>
  );
}
