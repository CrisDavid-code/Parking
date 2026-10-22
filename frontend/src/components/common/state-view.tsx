import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle, Box, Clock, CreditCard, Glasses, Inbox, Layers, Lock, LogIn, MapPinOff, Map as MapIcon, WifiOff, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";

export type StateKind =
  | "loading" | "empty" | "error" | "offline" | "forbidden" | "expired" | "stale" | "unknown-position"
  | "map-unavailable" | "level-unconfirmed" | "ar-unavailable" | "plan-limit" | "payments-not-configured" | "not-found";

const presets: Record<Exclude<StateKind, "loading">, { icon: typeof Inbox; title: string; desc: string; tone: string }> = {
  empty: { icon: Inbox, title: "Sin resultados", desc: "Todavía no hay información para mostrar.", tone: "muted" },
  "not-found": { icon: Box, title: "No encontrado", desc: "El recurso solicitado no existe o fue eliminado.", tone: "muted" },
  error: { icon: AlertTriangle, title: "Algo salió mal", desc: "No pudimos cargar la información.", tone: "danger" },
  offline: { icon: WifiOff, title: "Sin conexión", desc: "Revisa tu conexión a internet e inténtalo de nuevo.", tone: "warning" },
  forbidden: { icon: Lock, title: "Acceso denegado", desc: "No tienes permisos para ver esta sección.", tone: "danger" },
  expired: { icon: LogIn, title: "Sesión expirada", desc: "Inicia sesión nuevamente para continuar.", tone: "warning" },
  stale: { icon: Clock, title: "Datos desactualizados", desc: "La última información recibida es antigua.", tone: "warning" },
  "unknown-position": { icon: MapPinOff, title: "Posición desconocida", desc: "No hay una ubicación real disponible.", tone: "muted" },
  "map-unavailable": { icon: MapIcon, title: "Mapa no disponible", desc: "Mostramos los datos en formato de lista.", tone: "muted" },
  "level-unconfirmed": { icon: Layers, title: "Nivel sin confirmar", desc: "Indica en qué nivel te encuentras para continuar.", tone: "warning" },
  "ar-unavailable": { icon: Glasses, title: "AR no disponible", desc: "AR disponible próximamente en app nativa (ARKit/ARCore).", tone: "muted" },
  "plan-limit": { icon: CreditCard, title: "Suscripción insuficiente", desc: "Tu plan actual no incluye esta función o alcanzaste su límite.", tone: "warning" },
  "payments-not-configured": { icon: CreditCard, title: "Pagos no configurados todavía", desc: "El proveedor de pagos aún no está habilitado.", tone: "muted" },
};
const toneCls: Record<string, string> = {
  muted: "bg-muted text-muted-foreground",
  danger: "bg-destructive/10 text-destructive",
  warning: "bg-warning/15 text-warning-foreground",
};

export function StateView({
  kind, title, description, action, onRetry, className, compact,
}: {
  kind: StateKind; title?: string | undefined; description?: string | undefined; action?: ReactNode; onRetry?: (() => void) | undefined; className?: string | undefined; compact?: boolean | undefined;
}) {
  if (kind === "loading")
    return (
      <div className={cn("space-y-3", className)} aria-busy="true" aria-live="polite">
        <span className="sr-only">Cargando…</span>
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  const p = presets[kind];
  const Icon = p.icon;
  return (
    <div role={kind === "error" || kind === "forbidden" ? "alert" : "status"}
      className={cn("flex flex-col items-center justify-center text-center", compact ? "gap-2 py-6" : "gap-3 py-12", className)}>
      <div className={cn("flex size-12 items-center justify-center rounded-2xl", toneCls[p.tone])}>
        <Icon className="size-6" aria-hidden />
      </div>
      <div>
        <p className="font-display font-semibold text-foreground">{title ?? p.title}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description ?? p.desc}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>Reintentar</Button>}
        {kind === "expired" && <Button asChild size="sm"><Link to="/login">Iniciar sesión</Link></Button>}
        {kind === "plan-limit" && <Button asChild size="sm"><Link to="/app/subscription">Ver planes</Link></Button>}
        {action}
      </div>
    </div>
  );
}

export function kindFromError(e: unknown): StateKind {
  if (e instanceof ApiError) {
    if (e.status === 0) return typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error";
    if (e.status === 401) return "expired";
    if (e.status === 403) return "forbidden";
    if (e.status === 402) return "plan-limit";
    if (e.status === 404) return "not-found";
  }
  return "error";
}

export function ErrorState({ error, onRetry, compact }: { error: unknown; onRetry?: (() => void) | undefined; compact?: boolean | undefined }) {
  const kind = kindFromError(error);
  return <StateView kind={kind} compact={compact} description={kind === "error" && error instanceof Error ? error.message : undefined} onRetry={onRetry} />;
}

export function InlineSpinner() {
  return <Loader2 className="size-4 animate-spin" aria-hidden />;
}
