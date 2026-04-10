"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { citizenApi } from "@/lib/api";
import { formatDate, SERVICE_TYPE_LABELS } from "@/lib/helpers";
import type { ServiceRequestPublic } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PlusCircle,
  FileText,
  ClipboardList,
  ArrowRight,
  CheckCircle2,
  Clock,
} from "lucide-react";

export default function CitizenDashboardPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ServiceRequestPublic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    citizenApi
      .getMyRequests()
      .then(setRequests)
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, []);

  const submitted = requests.filter((r) => r.status === "submitted").length;
  const inReview = requests.filter((r) => r.status === "in_review").length;
  const approved = requests.filter((r) => r.status === "approved").length;
  const recent = requests.slice(0, 5);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Добро пожаловать, {user?.full_name?.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Управляйте своими запросами государственных услуг в одном месте.
        </p>
      </div>

      {/* Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-4 pt-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{loading ? "—" : submitted}</p>
              <p className="text-xs text-muted-foreground">Отправлено</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-4 pt-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
              <ClipboardList className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{loading ? "—" : inReview}</p>
              <p className="text-xs text-muted-foreground">На рассмотрении</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-4 pt-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{loading ? "—" : approved}</p>
              <p className="text-xs text-muted-foreground">Одобрено</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Быстрые действия</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button asChild className="justify-start gap-2">
              <Link href="/citizen/new-request">
                <PlusCircle className="h-4 w-4" />
                Подать новое обращение
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start gap-2">
              <Link href="/citizen/requests">
                <FileText className="h-4 w-4" />
                Смотреть все обращения
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Доступные услуги</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(["birth_certificate", "residence_certificate", "tax_clearance"] as const).map((st) => (
                <li key={st} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {SERVICE_TYPE_LABELS[st]}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Recent requests */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-semibold">Последние обращения</CardTitle>
          <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
            <Link href="/citizen/requests">
              Смотреть все <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Обращений еще нет.</p>
              <Button asChild size="sm" variant="outline">
                <Link href="/citizen/new-request">Подать первое обращение</Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recent.map((req) => (
                <Link
                  key={req.id}
                  href={`/citizen/requests/${req.id}`}
                  className="flex items-center justify-between gap-4 py-3 text-sm transition-colors hover:text-primary"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{req.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {SERVICE_TYPE_LABELS[req.service_type]} · {formatDate(req.created_at)}
                    </p>
                  </div>
                  <StatusBadge status={req.status} className="shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
