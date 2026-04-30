"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User, ChevronDown, Shield, FileText, LayoutDashboard, PlusCircle, List, ShieldCheck } from "lucide-react";

const CITIZEN_LINKS = [
  { href: "/citizen", label: "Панель", icon: LayoutDashboard },
  { href: "/citizen/new-request", label: "Новое обращение", icon: PlusCircle },
  { href: "/citizen/requests", label: "Мои обращения", icon: List },
];

const OPERATOR_LINKS = [
  { href: "/operator", label: "Все обращения", icon: FileText },
];

export function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const links = user?.role === "citizen" ? CITIZEN_LINKS : user?.role === "operator" ? OPERATOR_LINKS : [];

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6">
        {/* Logo */}
        <Link href={user?.role === "operator" ? "/operator" : "/citizen"} className="flex items-center gap-2.5 shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-primary">
            <Shield className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-foreground">
            Gossector
          </span>
        </Link>

        {/* Nav links */}
        {user && (
          <nav className="flex items-center gap-1" aria-label="Main navigation">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  pathname === href || (href !== "/citizen" && href !== "/operator" && pathname.startsWith(href))
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-3">
          {/* Role badge */}
          {user && (
            <span className="hidden rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium capitalize text-muted-foreground sm:inline">
              {user.role}
            </span>
          )}

          {/* User menu */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 text-sm">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline max-w-32 truncate">{user.full_name}</span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{user.full_name}</span>
                    <span className="text-xs text-muted-foreground">{user.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/account/security">
                    <ShieldCheck className="h-4 w-4" />
                    Безопасность
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  Выход
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Войти</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/register">Регистрация</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
