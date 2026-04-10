"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { citizenApi } from "@/lib/api";
import { formatDate, SERVICE_TYPE_LABELS } from "@/lib/helpers";
import type { ServiceRequestPublic } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, PlusCircle, ChevronRight } from "lucide-react";

export default function MyRequestsPage() {
  const [requests, setRequests] = useState<ServiceRequestPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    citizenApi
      .getMyRequests()
      .then(setRequests)
      .catch((err) => setError(err.message ?? "Failed to load requests."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageShell
      title="Мои обращения"
      description="Все запросы на государственные услуги, которые вы подали."
      action={
        <Button asChild size="sm">
          <Link href="/citizen/new-request">
            <PlusCircle className="h-4 w-4" />
            Новое обращение
          </Link>
        </Button>
      }
    >
      {loading ? (
        <Card className="shadow-sm">
          <CardContent className="pt-4">
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : requests.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Обращений еще нет"
          description="Вы еще не подали запросы на государственные услуги. Создайте свой первый запрос, чтобы начать."
          action={
            <Button asChild size="sm">
              <Link href="/citizen/new-request">
                <PlusCircle className="h-4 w-4" />
                Подать обращение
              </Link>
            </Button>
          }
        />
      ) : (
        <Card className="shadow-sm">
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {requests.map((req) => (
                <Link
                  key={req.id}
                  href={`/citizen/requests/${req.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-4 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-foreground text-sm">{req.title}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {SERVICE_TYPE_LABELS[req.service_type]} &middot; Submitted {formatDate(req.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge status={req.status} />
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
