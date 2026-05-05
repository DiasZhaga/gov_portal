"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowLeft,
  FileText,
  FileUp,
  Loader2,
  MessageSquare,
  Paperclip,
  Upload,
} from "lucide-react";

import { citizenApi } from "@/lib/api";
import {
  formatDateTime,
  formatFileSize,
  SERVICE_TYPE_LABELS,
  STATUS_LABELS,
} from "@/lib/helpers";
import type { AttachmentPublic, ServiceRequestPublic } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

const UPLOAD_ALLOWED_STATUSES = ["submitted", "in_review"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];

function DetailItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}

export default function CitizenRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [request, setRequest] = useState<ServiceRequestPublic | null>(null);
  const [attachments, setAttachments] = useState<AttachmentPublic[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<
    string | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    Promise.all([
      citizenApi.getRequest(id),
      citizenApi.getRequestAttachments(id),
    ])
      .then(([requestData, attachmentData]) => {
        if (cancelled) {
          return;
        }
        setRequest(requestData);
        setAttachments(attachmentData);
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        setError(
          err instanceof Error ? err.message : "Не удалось загрузить обращение."
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);

    const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setSelectedFile(null);
      setFileError(
        `Недопустимый формат файла. Разрешены: ${ALLOWED_EXTENSIONS.join(", ")}`
      );
      resetFileInput();
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setSelectedFile(null);
      setFileError("Размер файла превышает лимит 5 МБ.");
      resetFileInput();
      return;
    }

    setSelectedFile(file);
    setUploading(true);

    try {
      const attachment = await citizenApi.uploadAttachment(id, file);
      setAttachments((current) => [attachment, ...current]);
      setSelectedFile(null);
      resetFileInput();
      toast.success(`Файл «${file.name}» загружен.`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Не удалось загрузить файл."
      );
      resetFileInput();
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (attachment: AttachmentPublic) => {
    setDownloadingAttachmentId(attachment.id);
    try {
      await citizenApi.downloadAttachment(attachment);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Не удалось скачать файл."
      );
    } finally {
      setDownloadingAttachmentId(null);
    }
  };

  const canUpload = request && UPLOAD_ALLOWED_STATUSES.includes(request.status);

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Skeleton className="mb-6 h-8 w-48" />
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </main>
    );
  }

  if (error || !request) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">
            {error ?? "Обращение не найдено."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.back()}
        className="mb-6 gap-1.5 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Вернуться к обращениям
      </Button>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {request.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {SERVICE_TYPE_LABELS[request.service_type]}
          </p>
        </div>
        <StatusBadge status={request.status} className="mt-1 shrink-0" />
      </div>

      <div className="space-y-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">
              Детали обращения
            </CardTitle>
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
                  <span className="whitespace-pre-wrap leading-relaxed">
                    {request.description}
                  </span>
                </DetailItem>
              </div>
            </dl>
          </CardContent>
        </Card>

        {request.public_comment && (
          <Card className="border-blue-200 bg-blue-50/50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-blue-800">
                <MessageSquare className="h-4 w-4" />
                Комментарий оператора
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-blue-900">
                {request.public_comment}
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">
              Приложенные документы
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {attachments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
                Пока нет загруженных файлов.
              </div>
            ) : (
              <div className="space-y-3">
                {attachments.map((attachment, index) => (
                  <div key={attachment.id}>
                    {index > 0 && <Separator className="mb-3" />}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2">
                          <Paperclip className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 space-y-1">
                            <p className="truncate text-sm font-medium text-foreground">
                              {attachment.original_filename}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(attachment.file_size_bytes)} ·{" "}
                              {formatDateTime(attachment.uploaded_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        disabled={downloadingAttachmentId === attachment.id}
                        onClick={() => handleDownload(attachment)}
                      >
                        {downloadingAttachmentId === attachment.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowDownToLine className="h-4 w-4" />
                        )}
                        Скачать
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {canUpload && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">
                Приложить вспомогательные документы
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">
                Поддерживаемые форматы: PDF, JPG, JPEG, PNG. Максимальный размер
                файла: 5 МБ.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                id="file-upload"
                accept=".pdf,.jpg,.jpeg,.png"
                className="sr-only"
                onChange={handleFileChange}
                disabled={uploading}
                aria-label="Загрузить файл"
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

              {selectedFile && (
                <div className="mt-4 flex items-start gap-3 rounded-lg border bg-muted/30 px-4 py-3">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                </div>
              )}

              {fileError && (
                <p className="mt-2 text-xs text-destructive">{fileError}</p>
              )}
            </CardContent>
          </Card>
        )}

        {!canUpload &&
          (request.status === "approved" || request.status === "rejected") && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              <FileUp className="h-4 w-4 shrink-0" />
              Загрузка документов недоступна для обращений со статусом{" "}
              {STATUS_LABELS[request.status].toLowerCase()}.
            </div>
          )}
      </div>
    </main>
  );
}
