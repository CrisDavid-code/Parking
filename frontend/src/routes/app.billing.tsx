import { createFileRoute, Link } from "@tanstack/react-router";
import { useMySubscription, usePlans } from "@/modules/subscriptions/api";
import { PageHeader, Section, Field } from "@/components/common/page-header";
import { QueryView } from "@/components/common/query-view";
import { StateView } from "@/components/common/state-view";
import { Button } from "@/components/ui/button";
import { useFormat } from "@/lib/format";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/app/billing")({
  head: () => seo("Facturación"),
  component: Billing,
});

function Billing() {
  const sub = useMySubscription();
  const plans = usePlans();
  const f = useFormat();
  return (
    <>
      <PageHeader title="Facturación" />
      <QueryView query={sub}>
        {(s) => {
          const plan = plans.data?.find((p) => p.code === s.planCode);
          return (
            <div className="grid gap-4 lg:grid-cols-2">
              <Section title="Resumen">
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <Field label="Plan" value={plan?.name ?? s.planCode} />
                  <Field
                    label="Importe mensual"
                    value={plan ? f.money(plan.priceMonthly, plan.currency) : null}
                  />
                  <Field label="Estado" value={s.status} />
                  <Field label="Próximo período" value={f.date(s.currentPeriodEnd, false)} />
                </dl>
                <Button asChild variant="outline" size="sm" className="mt-4">
                  <Link to="/app/subscription">Cambiar plan</Link>
                </Button>
              </Section>
              <Section title="Método de pago y facturas">
                {s.paymentsConfigured ? (
                  <StateView
                    kind="empty"
                    compact
                    title="Sin facturas"
                    description="Las facturas emitidas por el proveedor de pagos aparecerán aquí."
                  />
                ) : (
                  <StateView kind="payments-not-configured" compact />
                )}
              </Section>
            </div>
          );
        }}
      </QueryView>
    </>
  );
}
