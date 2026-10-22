import { Badge } from "@/components/ui/badge";
import type { Freshness, TrackingStatus } from "@/types/api";

const freshLabel: Record<Freshness | "saved", string> = {
  live: "En vivo",
  recent: "Reciente",
  stale: "Desactualizada",
  saved: "Guardada",
};
export function FreshnessBadge({ value }: { value: Freshness | "saved" }) {
  return (
    <Badge
      variant={
        value === "live"
          ? "live"
          : value === "recent"
            ? "recent"
            : value === "stale"
              ? "stale"
              : "secondary"
      }
    >
      {value === "live" && (
        <span
          className="mr-1 inline-block size-1.5 animate-pulse rounded-full bg-current"
          aria-hidden
        />
      )}
      {freshLabel[value]}
    </Badge>
  );
}
const trackLabel: Record<TrackingStatus, string> = {
  none: "Sin rastreo",
  live: "En vivo",
  stale: "Desactualizado",
  offline: "Desconectado",
};
export function TrackingBadge({ value }: { value: TrackingStatus }) {
  return (
    <Badge variant={value === "live" ? "live" : value === "stale" ? "stale" : "secondary"}>
      {trackLabel[value]}
    </Badge>
  );
}
export function StatusBadge({ value }: { value: string }) {
  const good = ["active", "up", "open", "live"].includes(value);
  const bad = ["revoked", "down", "critical", "canceled"].includes(value);
  return <Badge variant={good ? "live" : bad ? "destructive" : "secondary"}>{value}</Badge>;
}
