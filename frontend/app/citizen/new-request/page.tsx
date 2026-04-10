"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { citizenApi } from "@/lib/api";
import { SERVICE_TYPE_LABELS } from "@/lib/helpers";
import type { ServiceType } from "@/lib/types";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

const SERVICE_TYPES: ServiceType[] = [
  "birth_certificate",
  "residence_certificate",
  "tax_clearance",
];

const schema = z.object({
  service_type: z.enum(["birth_certificate", "residence_certificate", "tax_clearance"], {
    required_error: "Выберите тип услуги",
  }),
  title: z
    .string()
    .min(3, "Название должно содержать не менее 3 символов")
    .max(255, "Название должно содержать не более 255 символов"),
  description: z
    .string()
    .min(5, "Описание должно содержать не менее 5 символов")
    .max(5000, "Описание должно содержать не более 5000 символов"),
});

type FormData = z.infer<typeof schema>;

export default function NewRequestPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const selectedType = watch("service_type");

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      const created = await citizenApi.createRequest(data);
      toast.success("Request submitted successfully.");
      router.push(`/citizen/requests/${created.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit request.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageShell
      title="Новое обращение"
      description="Заполните форму ниже, чтобы подать запрос на государственную услугу."
    >
      <div className="max-w-xl">
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
              {/* Service type */}
              <div className="space-y-1.5">
                <Label htmlFor="service_type">Тип услуги</Label>
                <Select
                  onValueChange={(val) => setValue("service_type", val as ServiceType, { shouldValidate: true })}
                  value={selectedType ?? ""}
                >
                  <SelectTrigger id="service_type" aria-invalid={!!errors.service_type}>
                    <SelectValue placeholder="Выберите услугу..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.map((st) => (
                      <SelectItem key={st} value={st}>
                        {SERVICE_TYPE_LABELS[st]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.service_type && (
                  <p className="text-xs text-destructive">{errors.service_type.message}</p>
                )}
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <Label htmlFor="title">Заголовок</Label>
                <Input
                  id="title"
                  placeholder="Краткое описание вашего запроса"
                  {...register("title")}
                  aria-invalid={!!errors.title}
                />
                {errors.title && (
                  <p className="text-xs text-destructive">{errors.title.message}</p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  rows={5}
                  placeholder="Подробно опишите ваш запрос, указав важные даты, номера документов или особые обстоятельства..."
                  {...register("description")}
                  aria-invalid={!!errors.description}
                />
                {errors.description && (
                  <p className="text-xs text-destructive">{errors.description.message}</p>
                )}
              </div>

              <div className="flex gap-3 pt-1">
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isLoading ? "Отправка..." : "Отправить обращение"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={isLoading}
                >
                  Отмена
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
