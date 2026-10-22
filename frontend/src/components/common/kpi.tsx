import type { LucideIcon } from "lucide-react";

export function Kpi({ label, value, icon: Icon }: { label: string; value: string | number; icon: LucideIcon }) {
  return (
    <div className="surface-card flex items-center gap-4 p-4">
      <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" aria-hidden /></span>
      <div><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="font-display text-2xl font-semibold">{value}</p></div>
    </div>
  );
}
