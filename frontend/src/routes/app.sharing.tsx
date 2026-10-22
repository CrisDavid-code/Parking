import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useShares, useShareMutations, PERMISSION_LABELS } from "@/modules/sharing/api";
import { useVehicles } from "@/modules/vehicles/api";
import { PageHeader, Section } from "@/components/common/page-header";
import { QueryView } from "@/components/common/query-view";
import { ConfirmButton } from "@/components/common/confirm-button";
import { StatusBadge } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/api/client";
import { useFormat } from "@/lib/format";
import type { SharePermission } from "@/types/api";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/app/sharing")({
  head: () => seo("Compartir"),
  component: Sharing,
});

const perms = Object.keys(PERMISSION_LABELS) as SharePermission[];
const schema = z.object({
  vehicleId: z.string().min(1, "Selecciona un vehículo"),
  granteeEmail: z.string().email("Correo inválido"),
  permissions: z
    .array(z.enum(["view_parking", "view_location", "alerts", "manage"]))
    .min(1, "Elige al menos un permiso"),
  expiresAt: z.string().optional(),
});

function Sharing() {
  const shares = useShares();
  const vehicles = useVehicles();
  const m = useShareMutations();
  const f = useFormat();
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { permissions: ["view_parking"], vehicleId: "" },
  });
  const e = form.formState.errors;
  const submit = form.handleSubmit(async (v) => {
    try {
      await m.create.mutateAsync({
        ...v,
        expiresAt: v.expiresAt ? new Date(v.expiresAt).toISOString() : undefined,
      });
      toast.success("Invitación enviada");
      form.reset({ permissions: ["view_parking"], vehicleId: v.vehicleId, granteeEmail: "" });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  });
  return (
    <>
      <PageHeader title="Compartir vehículos" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Nueva invitación">
          <form onSubmit={submit} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="vehicleId">Vehículo</Label>
              <select id="vehicleId" className="native-select" {...form.register("vehicleId")}>
                <option value="">Selecciona…</option>
                {vehicles.data?.items.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.alias}
                  </option>
                ))}
              </select>
              {e.vehicleId && <p className="text-xs text-destructive">{e.vehicleId.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="granteeEmail">Correo</Label>
              <Input id="granteeEmail" type="email" {...form.register("granteeEmail")} />
              {e.granteeEmail && (
                <p className="text-xs text-destructive">{e.granteeEmail.message}</p>
              )}
            </div>
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium">Permisos</legend>
              {perms.map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    value={p}
                    className="size-4"
                    {...form.register("permissions")}
                  />{" "}
                  {PERMISSION_LABELS[p]}
                </label>
              ))}
              {e.permissions && <p className="text-xs text-destructive">{e.permissions.message}</p>}
            </fieldset>
            <div className="space-y-1.5">
              <Label htmlFor="expiresAt">Vence (opcional)</Label>
              <Input id="expiresAt" type="date" {...form.register("expiresAt")} />
            </div>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              Enviar invitación
            </Button>
          </form>
        </Section>
        <div className="lg:col-span-2">
          <Section title="Accesos compartidos">
            <QueryView query={shares} isEmpty={(d) => d.items.length === 0}>
              {(d) => (
                <ul className="divide-y divide-border">
                  {d.items.map((s) => (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                    >
                      <div>
                        <p className="font-medium">
                          {s.granteeEmail} ·{" "}
                          {vehicles.data?.items.find((v) => v.id === s.vehicleId)?.alias ??
                            "Vehículo"}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {s.permissions.map((p) => (
                            <Badge key={p} variant="secondary">
                              {PERMISSION_LABELS[p]}
                            </Badge>
                          ))}
                        </div>
                        {s.expiresAt && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Vence {f.date(s.expiresAt, false)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge value={s.status} />
                        <ConfirmButton
                          title="Revocar acceso"
                          description={`${s.granteeEmail} perderá el acceso.`}
                          successMessage="Acceso revocado"
                          trigger={
                            <Button size="sm" variant="ghost">
                              Revocar
                            </Button>
                          }
                          onConfirm={() => m.remove.mutateAsync(s.id)}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </QueryView>
          </Section>
        </div>
      </div>
    </>
  );
}
