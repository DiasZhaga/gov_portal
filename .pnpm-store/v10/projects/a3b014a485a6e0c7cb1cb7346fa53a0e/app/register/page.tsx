"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Shield, Loader2 } from "lucide-react";

import { authApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const schema = z
  .object({
    full_name: z
      .string()
      .min(2, "Полное имя должно содержать не менее 2 символов")
      .max(255, "Полное имя не должно превышать 255 символов"),
    email: z.string().email("Введите действительный адрес электронной почты"),
    iin: z.string().regex(/^\d{12}$/, "ИИН должен состоять ровно из 12 цифр"),
    password: z
      .string()
      .min(8, "Пароль должен содержать не менее 8 символов")
      .max(128, "Пароль не должен превышать 128 символов"),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "Пароли не совпадают",
    path: ["confirm_password"],
  });

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
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
      await authApi.register({
        full_name: data.full_name,
        email: data.email,
        iin: data.iin,
        password: data.password,
      });
      toast.success("Аккаунт создан. Теперь войдите в систему.");
      router.push("/login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось создать аккаунт.");
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
          <CardTitle className="text-base">Создать аккаунт</CardTitle>
          <CardDescription>Зарегистрируйтесь как гражданин для подачи запросов услуг</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Полное имя</Label>
              <Input
                id="full_name"
                type="text"
                autoComplete="name"
                placeholder="Иван Иванов"
                {...register("full_name")}
                aria-invalid={!!errors.full_name}
              />
              {errors.full_name && (
                <p className="text-xs text-destructive">{errors.full_name.message}</p>
              )}
            </div>

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
              <Label htmlFor="iin">ИИН</Label>
              <Input
                id="iin"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="12 цифр"
                maxLength={12}
                {...register("iin")}
                aria-invalid={!!errors.iin}
              />
              {errors.iin && (
                <p className="text-xs text-destructive">{errors.iin.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="Минимум 8 символов"
                {...register("password")}
                aria-invalid={!!errors.password}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm_password">Подтвердить пароль</Label>
              <Input
                id="confirm_password"
                type="password"
                autoComplete="new-password"
                placeholder="Повторите пароль"
                {...register("confirm_password")}
                aria-invalid={!!errors.confirm_password}
              />
              {errors.confirm_password && (
                <p className="text-xs text-destructive">{errors.confirm_password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLoading ? "Создание аккаунта..." : "Создать аккаунт"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Уже есть аккаунт?{" "}
            <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
              Войти
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
