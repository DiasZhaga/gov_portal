"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Shield, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NoPermissionPage() {
  const { user } = useAuth();
  const router = useRouter();

  const homeHref = user?.role === "operator" ? "/operator" : user ? "/citizen" : "/login";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
        <Shield className="h-7 w-7 text-destructive" />
      </div>
      <h1 className="mt-5 text-xl font-semibold text-foreground">Нет доступа</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        У вас нет прав для просмотра этой страницы. Если вы считаете, что это ошибка,
        обратитесь к администратору.
      </p>
      <div className="mt-6 flex gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Назад
        </Button>
        <Button asChild size="sm">
          <Link href={homeHref}>На главную</Link>
        </Button>
      </div>
    </div>
  );
}
