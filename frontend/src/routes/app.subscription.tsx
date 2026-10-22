import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useMySubscription, useSubscriptionMutations } from "@/modules/subscriptions/api";
import { PricingGrid } from "@/modules/subscriptions/pricing-grid";
import { PageHeader } from "@/components/common/page-header";
import { QueryView } from "@/components/common/query-view";
import { StateView } from "@/components/common/state-view";
import { ConfirmButton } from "@/components/common/confirm-button";
import { StatusBadge } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import { ApiError, errorMessage } from "@/lib/api/client";
import { useFormat } from "@/lib/format";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/app/subscription")({ head: () => seo("Suscripción"), component: SubscriptionPage });

function SubscriptionPage() {
  const sub = useMySubscription();
  const m = useSubscriptionMutations();
  const f = useFormat();
  return (
    <>
      <PageHeader title="Suscripción" />
      <QueryView query={sub}>
        {(s) => (
          <div className="space-y-6">
            <div className="surface-card flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <p className="text-sm text-muted-foreground">Plan actual</p>
                <p className="font-display text-xl font-semibold uppercase">{s.planCode}</p>
                {s.currentPeriodEnd && <p className="text-xs text-muted-foreground">{s.cancelAtPeriodEnd ? "Termina" : "Renueva"} el {f.date(s.currentPeriodEnd, false)}</p>}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge value={s.status} />
                {s.planCode !== "free" && s.paymentsConfigured && !s.cancelAtPeriodEnd && (
                  <ConfirmButton title="Cancelar suscripción" description="Mantendrás el acceso hasta el fin del período." successMessage="Suscripción cancelada"
                    trigger={<Button variant="outline" size="sm">Cancelar</Button>} onConfirm={() => m.cancel.mutateAsync()} />
                )}
              </div>
            </div>
            {!s.paymentsConfigured && <StateView kind="payments-not-configured" className="surface-card" description="No es posible cambiar de plan de pago todavía. Tu plan actual sigue activo." />}
            <PricingGrid currentCode={s.planCode} action={(p) => (
              <Button className="w-full" variant={p.code === s.planCode ? "secondary" : "default"}
                disabled={p.code === s.planCode || !s.paymentsConfigured || m.change.isPending}
                onClick={async () => {
                  try {
                    await m.change.mutateAsync(p.code);
                    toast.success(`Solicitud de cambio a ${p.name} enviada`);
                  } catch (e) {
                    toast.error(e instanceof ApiError && e.status === 402 ? "Pago requerido: completa el pago con el proveedor." : errorMessage(e));
                  }
                }}>
                {p.code === s.planCode ? "Plan actual" : "Cambiar a este plan"}
              </Button>
            )} />
          </div>
        )}
      </QueryView>
    </>
  );
}
