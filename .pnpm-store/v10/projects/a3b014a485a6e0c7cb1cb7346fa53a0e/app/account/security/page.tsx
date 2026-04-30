"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { CheckCircle2, Copy, KeyRound, Loader2, ShieldCheck } from "lucide-react";

import { authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Navbar } from "@/components/navbar";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function SecurityPage() {
  const router = useRouter();
  const { user, loading, refreshUser } = useAuth();
  const [setupUri, setSetupUri] = useState("");
  const [code, setCode] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, router, user]);

  const startSetup = async () => {
    setIsStarting(true);
    try {
      const res = await authApi.setupMfa();
      setSetupUri(res.otpauth_uri);
      toast.success("MFA готова к настройке. Отсканируйте QR-код в приложении.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось начать настройку MFA.");
    } finally {
      setIsStarting(false);
    }
  };

  const confirmSetup = async () => {
    if (!/^\d{6}$/.test(code)) {
      toast.error("Введите 6-значный код из приложения-аутентификатора.");
      return;
    }

    setIsConfirming(true);
    try {
      await authApi.confirmMfa({ code });
      await refreshUser();
      setCode("");
      setSetupUri("");
      toast.success("MFA включена для аккаунта.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось подтвердить MFA.");
    } finally {
      setIsConfirming(false);
    }
  };

  const copySetupUri = async () => {
    if (!setupUri || typeof navigator === "undefined") return;
    await navigator.clipboard.writeText(setupUri);
    toast.success("URI скопирован.");
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <PageShell
        title="Безопасность аккаунта"
        description="Управляйте входом в аккаунт и двухфакторной аутентификацией."
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4" />
                Двухфакторная аутентификация
              </CardTitle>
              <CardDescription>
                Используйте Microsoft Authenticator, Google Authenticator или другое TOTP-приложение.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Статус MFA</p>
                  <p className="text-xs text-muted-foreground">
                    {user.mfa_enabled
                      ? "При входе потребуется одноразовый код."
                      : "Сейчас вход выполняется только по паролю."}
                  </p>
                </div>
                <Badge variant={user.mfa_enabled ? "default" : "outline"}>
                  {user.mfa_enabled ? "Включена" : "Отключена"}
                </Badge>
              </div>

              {!user.mfa_enabled && !setupUri && (
                <Button onClick={startSetup} disabled={isStarting} className="gap-2">
                  {isStarting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <KeyRound className="h-4 w-4" />
                  )}
                  Включить MFA
                </Button>
              )}

              {!user.mfa_enabled && setupUri && (
                <div className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                    <div className="flex justify-center rounded-md border border-border bg-white p-4">
                      <QRCodeSVG
                        value={setupUri}
                        size={188}
                        level="M"
                        includeMargin
                        aria-label="QR-код для настройки MFA"
                      />
                    </div>

                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">Как подключить</p>
                        <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
                          <li>Откройте Microsoft Authenticator или Google Authenticator.</li>
                          <li>Выберите добавление новой учетной записи.</li>
                          <li>Отсканируйте QR-код.</li>
                          <li>Введите 6-значный код ниже.</li>
                        </ol>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Если камера недоступна, скопируйте URI и добавьте его вручную в приложении.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="otpauth_uri">Ручная настройка</Label>
                    <Textarea
                      id="otpauth_uri"
                      value={setupUri}
                      readOnly
                      className="min-h-24 font-mono text-xs"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={copySetupUri} className="gap-2">
                      <Copy className="h-4 w-4" />
                      Скопировать URI
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="mfa_code">Код подтверждения</Label>
                    <Input
                      id="mfa_code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="123456"
                      maxLength={6}
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      className="max-w-40 tracking-widest"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={confirmSetup} disabled={isConfirming} className="gap-2">
                      {isConfirming && <Loader2 className="h-4 w-4 animate-spin" />}
                      Подтвердить MFA
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={isConfirming}
                      onClick={() => {
                        setSetupUri("");
                        setCode("");
                      }}
                    >
                      Отмена
                    </Button>
                  </div>
                </div>
              )}

              {user.mfa_enabled && (
                <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  MFA успешно включена для этого аккаунта.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Профиль</CardTitle>
              <CardDescription>Данные, которые backend возвращает безопасно.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Имя</p>
                <p className="font-medium text-foreground">{user.full_name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium text-foreground">{user.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ИИН</p>
                <p className="font-mono text-foreground">{user.iin_masked}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Роль</p>
                <p className="font-medium capitalize text-foreground">{user.role}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageShell>
    </div>
  );
}
