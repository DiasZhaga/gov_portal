"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Shield, Loader2 } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const schema = z.object({
  email: z.string().email("Введите действительный адрес электронной почты"),
  password: z
    .string()
    .min(8, "Пароль обязателен")
    .max(128, "Пароль не должен превышать 128 символов"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      const res = await authApi.login(data);
      await login(res.access_token);
      // After login, get role from auth context to redirect correctly
      const me = await authApi.me();
      if (me.role === "operator") {
        router.push("/operator");
      } else {
        router.push("/citizen");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      {/* Portal header */}
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-sm">
          <Shield className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Gossector Portal</h1>
          <p className="mt-1 text-sm text-muted-foreground">Система запросов государственных услуг</p>
        </div>
      </div>

      <Card className="w-full max-w-sm shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Вход в аккаунт</CardTitle>
          <CardDescription>Введите данные для входа</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Электронная почта</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.gov"
                {...register("email")}
                aria-invalid={!!errors.email}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                {...register("password")}
                aria-invalid={!!errors.password}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLoading ? "Вход..." : "Войти"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Нет аккаунта?{" "}
            <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
              Зарегистрируйтесь
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
