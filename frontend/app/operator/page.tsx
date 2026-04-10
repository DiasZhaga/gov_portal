"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { operatorApi } from "@/lib/api";
import { formatDate, SERVICE_TYPE_LABELS, STATUS_LABELS } from "@/lib/helpers";
import type { ServiceRequestPublic, RequestStatus } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { ClipboardList, ChevronRight, Search, X } from "lucide-react";

const ALL_STATUSES: RequestStatus[] = ["submitted", "in_review", "approved", "rejected"];

export default function OperatorRequestsPage() {
  const [requests, setRequests] = useState<ServiceRequestPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "all">("all");

  useEffect(() => {
    operatorApi
      .getAllRequests()
      .then(setRequests)
      .catch((err) => setError(err.message ?? "Failed to load requests."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      const matchesStatus = statusFilter === "all" || r.status === statusFilter;
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        SERVICE_TYPE_LABELS[r.service_type].toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [requests, statusFilter, search]);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
  };

  const hasFilters = search !== "" || statusFilter !== "all";

  return (
    <PageShell
      title="Все обращения"
      description="Просмотрите и управляйте всеми запросами на государственные услуги граждан."
    >
      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Поиск обращений..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as RequestStatus | "all")}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Все статусы" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
            <X className="h-3.5 w-3.5" />
            Очистить
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {loading ? "..." : `${filtered.length} обращени${filtered.length === 1 ? "е" : "й"}`}
        </span>
      </div>

      {/* Table / list */}
      {loading ? (
        <Card className="shadow-sm">
          <CardContent className="pt-4">
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={hasFilters ? "Совпадающих обращений не найдено" : "Обращений еще нет"}
          description={
            hasFilters
              ? "Попробуйте изменить критерии поиска или фильтрации."
              : "Запросы на государственные услуги от граждан еще не поступали."
          }
          action={
            hasFilters ? (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Очистить фильтры
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card className="shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="hidden border-b border-border bg-muted/40 px-4 py-2.5 sm:grid sm:grid-cols-[1fr_160px_140px_100px_36px] sm:items-center">
            <span className="text-xs font-medium text-muted-foreground">Заголовок / Услуга</span>
            <span className="text-xs font-medium text-muted-foreground">Отправлено</span>
            <span className="text-xs font-medium text-muted-foreground">Обновлено</span>
            <span className="text-xs font-medium text-muted-foreground">Статус</span>
            <span />
          </div>
          <div className="divide-y divide-border">
            {filtered.map((req) => (
              <Link
                key={req.id}
                href={`/operator/requests/${req.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-muted/40 sm:grid sm:grid-cols-[1fr_160px_140px_100px_36px] sm:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground text-sm">{req.title}</p>
                  <p className="text-xs text-muted-foreground">{SERVICE_TYPE_LABELS[req.service_type]}</p>
                </div>
                <span className="hidden text-xs text-muted-foreground sm:block">
                  {formatDate(req.created_at)}
                </span>
                <span className="hidden text-xs text-muted-foreground sm:block">
                  {formatDate(req.updated_at)}
                </span>
                <StatusBadge status={req.status} className="shrink-0" />
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </Card>
      )}
    </PageShell>
  );
}
