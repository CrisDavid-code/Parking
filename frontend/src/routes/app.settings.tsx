import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useAuth } from "@/modules/auth/auth-context";
import { PageHeader, Section } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePreferences, type Preferences } from "@/config/i18n";
import { api, errorMessage } from "@/lib/api/client";
import type { User } from "@/types/api";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/app/settings")({ head: () => seo("Ajustes"), component: Settings });

const profileSchema = z.object({ fullName: z.string().min(2, "Requerido") });
const zones = ["America/Guatemala", "America/Mexico_City", "America/Bogota", "America/New_York", "Europe/Madrid", "UTC"];

function Settings() {
  const { user, setUser } = useAuth();
  const { prefs, setPrefs } = usePreferences();
  const form = useForm<z.infer<typeof profileSchema>>({ resolver: zodResolver(profileSchema), values: { fullName: user?.fullName ?? "" } });
  const save = form.handleSubmit(async (v) => {
    try {
      setUser(await api.patch<User>("/users/me", v));
      toast.success("Perfil actualizado");
    } catch (e) { toast.error(errorMessage(e)); }
  });
  const sel = <K extends keyof Preferences>(k: K, label: string, options: { value: string; label: string }[]) => (
    <div className="space-y-1.5">
      <Label htmlFor={k}>{label}</Label>
      <select id={k} className="native-select" value={prefs[k]} onChange={(e) => { setPrefs({ [k]: e.target.value } as Partial<Preferences>); toast.success("Preferencia guardada"); }}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
  return (
    <>
      <PageHeader title="Ajustes" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Perfil">
          <form onSubmit={save} noValidate className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="fullName">Nombre</Label><Input id="fullName" {...form.register("fullName")} />
              {form.formState.errors.fullName && <p className="text-xs text-destructive">{form.formState.errors.fullName.message}</p>}</div>
            <div className="space-y-1.5"><Label htmlFor="email">Correo</Label><Input id="email" value={user?.email ?? ""} disabled readOnly /></div>
            <Button type="submit" disabled={form.formState.isSubmitting}>Guardar</Button>
          </form>
        </Section>
        <Section title="Región y formato">
          <div className="grid gap-4 sm:grid-cols-2">
            {sel("locale", "Idioma", [{ value: "es", label: "Español" }, { value: "en", label: "English" }])}
            {sel("currency", "Moneda", ["GTQ", "USD", "MXN", "EUR"].map((c) => ({ value: c, label: c })))}
            {sel("timeZone", "Zona horaria", zones.map((z) => ({ value: z, label: z })))}
            {sel("dateFormat", "Formato de fecha", ["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd"].map((d) => ({ value: d, label: d })))}
          </div>
        </Section>
      </div>
    </>
  );
}
