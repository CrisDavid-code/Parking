import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Section } from "@/components/common/page-header";
import { ConfirmButton } from "@/components/common/confirm-button";
import { InlineSpinner } from "@/components/common/state-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage } from "@/lib/api/client";
import { useAuth } from "@/modules/auth/auth-context";
import { brand } from "@/config/brand";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/app/privacy")({
  head: () => seo("Privacidad"),
  component: Privacy,
});

function Privacy() {
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const { logout } = useAuth();
  const navigate = useNavigate();
  const exportData = async () => {
    setBusy(true);
    try {
      const data = await api.get<unknown>("/users/me/export");
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `${brand.name.toLowerCase()}-datos.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exportación descargada");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeader title="Privacidad" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Ubicación">
          <p className="text-sm text-muted-foreground">
            Solo solicitamos la ubicación cuando pulsas “Usar mi ubicación” o “Mostrar mi
            ubicación”. Puedes revocar el permiso desde la configuración de tu navegador.
          </p>
        </Section>
        <Section title="Exportar mis datos">
          <p className="mb-4 text-sm text-muted-foreground">
            Descarga una copia de tus vehículos, estacionamientos y ajustes en formato JSON.
          </p>
          <Button onClick={exportData} disabled={busy}>
            {busy ? <InlineSpinner /> : <Download className="size-4" />} Exportar datos
          </Button>
        </Section>
        <Section title="Eliminar mi cuenta">
          <p className="mb-4 text-sm text-muted-foreground">
            Se eliminarán permanentemente tu cuenta y todos tus datos.
          </p>
          <div className="mb-4 max-w-xs space-y-1.5">
            <Label htmlFor="delete-password">Confirma tu contraseña</Label>
            <Input
              id="delete-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <ConfirmButton
            title="¿Eliminar tu cuenta?"
            description="Esta acción es irreversible."
            confirmLabel="Eliminar definitivamente"
            successMessage="Cuenta eliminada"
            trigger={
              <Button variant="destructive" disabled={!password}>
                <Trash2 className="size-4" /> Eliminar cuenta
              </Button>
            }
            onConfirm={async () => {
              await api.delete("/users/me", { password });
              await logout();
              navigate({ to: "/" });
            }}
          />
        </Section>
      </div>
    </>
  );
}
