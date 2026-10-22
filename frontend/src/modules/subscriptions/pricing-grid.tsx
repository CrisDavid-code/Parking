import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { QueryView } from "@/components/common/query-view";
import { useFormat } from "@/lib/format";
import type { Plan, PlanCode } from "@/types/api";
import { PLAN_FEATURES, usePlans } from "./api";
import { cn } from "@/lib/utils";

export function PricingGrid({ currentCode, action }: { currentCode?: PlanCode; action?: (p: Plan) => ReactNode }) {
  const plans = usePlans();
  const f = useFormat();
  return (
    <QueryView query={plans} isEmpty={(d) => d.length === 0}>
      {(data) => (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data.map((p) => (
            <article key={p.code} className={cn("surface-card flex flex-col p-6", (p.code === currentCode || (!currentCode && p.code === "plus")) && "ring-2 ring-primary")}>
              <h3 className="font-semibold">{p.name}</h3>
              <p className="mt-2 font-display text-3xl font-bold">
                {f.money(p.priceMonthly, p.currency)}<span className="text-sm font-normal text-muted-foreground"> /mes</span>
              </p>
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {PLAN_FEATURES[p.code]?.map((x) => <li key={x} className="flex gap-2"><Check className="size-4 text-teal" aria-hidden />{x}</li>)}
                <li className="text-muted-foreground">{p.limits.vehicles} vehículos · {p.limits.devices} dispositivos</li>
                <li className="text-muted-foreground">{p.limits.historyDays} días de historial · {p.limits.members} miembros</li>
              </ul>
              {action && <div className="mt-5">{action(p)}</div>}
            </article>
          ))}
        </div>
      )}
    </QueryView>
  );
}
