import { cn } from "@/lib/utils";

interface PageShellProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function PageShell({
  title,
  description,
  action,
  children,
  className,
}: PageShellProps) {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className={cn("flex items-start justify-between gap-4", (action) && "mb-6")}>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className={cn(!action && "mt-6", className)}>{children}</div>
    </main>
  );
}
