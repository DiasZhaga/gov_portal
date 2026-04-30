"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { KeyRound, Loader2, Shield } from "lucide-react";

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

const mfaSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Введите 6-значный код"),
});

type FormData = z.infer<typeof schema>;
type MfaFormData = z.infer<typeof mfaSchema>;

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const {
    register: registerMfa,
    handleSubmit: handleMfaSubmit,
    formState: { errors: mfaErrors },
  } = useForm<MfaFormData>({ resolver: zodResolver(mfaSchema) });

  const finishLogin = async (accessToken: string) => {
    const me = await login(accessToken);
    router.push(me.role === "operator" ? "/operator" : "/citizen");
  };

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      const res = await authApi.login(data);
      if ("mfa_required" in res && res.mfa_required) {
        setMfaToken(res.mfa_token);
        setLoginEmail(data.email);
        toast.info("Введите код из приложения-аутентификатора.");
        return;
      }
      if ("access_token" in res) {
        await finishLogin(res.access_token);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось войти. Проверьте данные.");
    } finally {
      setIsLoading(false);
    }
  };

  const onMfaSubmit = async (data: MfaFormData) => {
    if (!mfaToken) return;
    setIsLoading(true);
    try {
      const res = await authApi.verifyMfaLogin({
        mfa_token: mfaToken,
        code: data.code,
      });
      setMfaToken(null);
      await finishLogin(res.access_token);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось подтвердить код.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
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
          <CardTitle className="text-base">
            {mfaToken ? "Подтверждение входа" : "Вход в аккаунт"}
          </CardTitle>
          <CardDescription>
            {mfaToken
              ? `Введите 6-значный код для ${loginEmail}`
              : "Введите данные для входа"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!mfaToken ? (
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
          ) : (
            <form onSubmit={handleMfaSubmit(onMfaSubmit)} noValidate className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="code">Код MFA</Label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    maxLength={6}
                    className="pl-9 tracking-widest"
                    {...registerMfa("code")}
                    aria-invalid={!!mfaErrors.code}
                  />
                </div>
                {mfaErrors.code && (
                  <p className="text-xs text-destructive">{mfaErrors.code.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {isLoading ? "Проверка..." : "Подтвердить вход"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                disabled={isLoading}
                onClick={() => setMfaToken(null)}
              >
                Назад к вводу пароля
              </Button>
            </form>
          )}

          {!mfaToken && (
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Нет аккаунта?{" "}
              <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
                Зарегистрируйтесь
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
