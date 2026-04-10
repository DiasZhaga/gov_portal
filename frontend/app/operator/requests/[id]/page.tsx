"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Loader2,
  ArrowLeft,
  AlertCircle,
  MessageSquare,
  RefreshCw,
} from "lucide-react";

import { operatorApi } from "@/lib/api";
import {
  formatDateTime,
  SERVICE_TYPE_LABELS,
  STATUS_LABELS,
  STATUS_TRANSITIONS,
} from "@/lib/helpers";
import type { ServiceRequestPublic, RequestStatus } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}

const schema = z.object({
  status: z.string().min(1, "Выберите новый статус"),
  public_comment: z.string().max(2000, "Комментарий должен содержать не более 2000 символов").optional(),
});

type FormData = z.infer<typeof schema>;

export default function OperatorRequestReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [request, setRequest] = useState<ServiceRequestPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const selectedStatus = watch("status");

  useEffect(() => {
    operatorApi
      .getAllRequests()
      .then((all) => {
        const found = all.find((r) => r.id === id);
        if (!found) throw new Error("Request not found.");
        setRequest(found);
      })
      .catch((err) => setError(err.message ?? "Failed to load request."))
      .finally(() => setLoading(false));
  }, [id]);

  const allowedNextStatuses: RequestStatus[] =
    request ? STATUS_TRANSITIONS[request.status] : [];

  const onSubmit = async (data: FormData) => {
    if (!request) return;
    setIsSubmitting(true);
    try {
      const updated = await operatorApi.updateStatus(id, {
        status: data.status as RequestStatus,
        public_comment: data.public_comment || undefined,
      });
      setRequest(updated);
      reset({ status: "", public_comment: "" });
      toast.success("Request status updated successfully.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Skeleton className="mb-6 h-8 w-48" />
        <div className="space-y-4">
          <Skeleton className="h-52 w-full" />
          <Skeleton className="h-32 w-full" />
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
        {/* Request details */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Информация об обращении</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-5 sm:grid-cols-2">
              <DetailItem label="Тип услуги">
                {SERVICE_TYPE_LABELS[request.service_type]}
              </DetailItem>
              <DetailItem label="Текущий статус">
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

        {/* Existing public comment */}
        {request.public_comment && (
          <Card className="shadow-sm border-blue-200 bg-blue-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-blue-800">
                <MessageSquare className="h-4 w-4" />
                Текущий публичный комментарий
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-blue-900 leading-relaxed">{request.public_comment}</p>
            </CardContent>
          </Card>
        )}

        {/* Status update form */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <RefreshCw className="h-4 w-4" />
              Обновить статус
            </CardTitle>
          </CardHeader>
          <CardContent>
            {allowedNextStatuses.length === 0 ? (
              <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                Дальнейшие переходы статуса недоступны для обращения со статусом{" "}
                <strong>{STATUS_LABELS[request.status]}</strong>.
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="status">Новый статус</Label>
                  <Select
                    onValueChange={(val) => setValue("status", val, { shouldValidate: true })}
                    value={selectedStatus ?? ""}
                  >
                    <SelectTrigger id="status" aria-invalid={!!errors.status}>
                      <SelectValue placeholder="Выберите следующий статус..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allowedNextStatuses.map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.status && (
                    <p className="text-xs text-destructive">{errors.status.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="public_comment">
                    Публичный комментарий{" "}
                    <span className="font-normal text-muted-foreground">(необязательно)</span>
                  </Label>
                  <Textarea
                    id="public_comment"
                    rows={3}
                    placeholder="Добавьте сообщение, видимое для гражданина..."
                    {...register("public_comment")}
                    aria-invalid={!!errors.public_comment}
                  />
                  {errors.public_comment && (
                    <p className="text-xs text-destructive">{errors.public_comment.message}</p>
                  )}
                </div>

                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isSubmitting ? "Обновление..." : "Обновить статус"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
