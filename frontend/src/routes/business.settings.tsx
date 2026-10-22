import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { OrgGate } from "@/modules/fleet/org-gate";
import { useOrganizationMutations } from "@/modules/fleet/api";
import { PageHeader, Section, Field } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/api/client";
import { useFormat } from "@/lib/format";
import type { Organization } from "@/types/api";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/business/settings")({
  head: () => seo("Ajustes de empresa"),
  component: () => <OrgGate>{(_p, o) => <Page org={o} />}</OrgGate>,
});
const schema = z.object({ name: z.string().min(2, "Requerido").max(80) });

function Page({ org }: { org: Organization }) {
  const { update } = useOrganizationMutations();
  const f = useFormat();
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    values: { name: org.name },
  });
  const submit = form.handleSubmit(async (v) => {
    try {
      await update.mutateAsync({ id: org.id, ...v });
      toast.success("Organización actualizada");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });
  return (
    <>
      <PageHeader title="Ajustes de la empresa" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Datos generales">
          <form onSubmit={submit} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              Guardar
            </Button>
          </form>
        </Section>
        <Section title="Información">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <Field label="ID" value={<span className="font-mono text-xs">{org.id}</span>} />
            <Field label="Plan" value={org.planCode?.toUpperCase()} />
            <Field label="Creada" value={f.date(org.createdAt, false)} />
          </dl>
        </Section>
      </div>
    </>
  );
}
