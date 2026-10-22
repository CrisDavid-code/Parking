import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Building2, Check, Cpu, Layers, MapPin, Navigation, ShieldCheck, User } from "lucide-react";
import { useAuth } from "@/modules/auth/auth-context";
import { useVehicleMutations } from "@/modules/vehicles/api";
import { VehicleForm } from "@/modules/vehicles/vehicle-form";
import { useOrganizationMutations } from "@/modules/fleet/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { errorMessage } from "@/lib/api/client";
import { brand } from "@/config/brand";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/app/onboarding")({ head: () => seo("Bienvenida"), component: Onboarding });

const steps = [
  { key: "account", title: "Tu cuenta", icon: User, optional: false },
  { key: "type", title: "Personal o empresa", icon: Building2, optional: false },
  { key: "vehicle", title: "Primer vehículo", icon: MapPin, optional: true },
  { key: "location", title: "Preferencias de ubicación", icon: Layers, optional: true },
  { key: "permissions", title: "Permisos", icon: ShieldCheck, optional: false },
  { key: "parking", title: "Primer estacionamiento", icon: MapPin, optional: true },
  { key: "device", title: "Dispositivo", icon: Cpu, optional: true },
  { key: "nav", title: "Navegación", icon: Navigation, optional: false },
] as const;

function Onboarding() {
  const { user } = useAuth();
  const [i, setI] = useState(0);
  const [type, setType] = useState<"personal" | "business">(user?.accountType ?? "personal");
  const [orgName, setOrgName] = useState("");
  const [locPref, setLocPref] = useState<"ask" | "manual">("ask");
  const v = useVehicleMutations();
  const org = useOrganizationMutations();
  const navigate = useNavigate();
  const step = steps[i] ?? steps[0];
  const next = () => (i < steps.length - 1 ? setI(i + 1) : navigate({ to: "/app" }));

  const body = () => {
    switch (step.key) {
      case "account":
        return <p>Hola <strong>{user?.fullName}</strong>, tu cuenta ({user?.email}) está lista. Te ayudaremos a configurar {brand.name} en unos pasos.</p>;
      case "type":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {(["personal", "business"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setType(t)} aria-pressed={type === t}
                  className={`rounded-xl border p-4 text-left transition ${type === t ? "border-primary bg-primary/5" : "border-border"}`}>
                  <p className="font-semibold">{t === "personal" ? "Personal" : "Empresa"}</p>
                  <p className="text-xs text-muted-foreground">{t === "personal" ? "Mis vehículos y familia" : "Flota, conductores y reportes"}</p>
                </button>
              ))}
            </div>
            {type === "business" && (
              <div className="space-y-1.5"><Label htmlFor="org">Nombre de la empresa</Label><Input id="org" value={orgName} onChange={(e) => setOrgName(e.target.value)} /></div>
            )}
          </div>
        );
      case "vehicle":
        return <VehicleForm submitLabel="Crear y continuar" onSubmit={async (d) => {
          try { await v.create.mutateAsync(d); toast.success("Vehículo creado"); next(); } catch (e) { toast.error(errorMessage(e)); }
        }} />;
      case "location":
        return (
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm">¿Cómo prefieres registrar tus estacionamientos?</legend>
            {([["ask", "Usar GPS cuando lo pida, y completar nivel/plaza"], ["manual", "Solo registro manual (sin GPS)"]] as const).map(([k, l]) => (
              <label key={k} className="flex items-center gap-2 text-sm"><input type="radio" name="loc" checked={locPref === k} onChange={() => setLocPref(k)} /> {l}</label>
            ))}
          </fieldset>
        );
      case "permissions":
        return (
          <ul className="space-y-2 text-sm">
            <li className="flex gap-2"><Check className="size-4 text-teal" /> Pediremos tu ubicación <strong>solo</strong> al tocar “Usar mi ubicación”.</li>
            <li className="flex gap-2"><Check className="size-4 text-teal" /> Puedes negar el permiso y registrar todo manualmente.</li>
            <li className="flex gap-2"><Check className="size-4 text-teal" /> Las fotos se suben solo si tú las adjuntas.</li>
          </ul>
        );
      case "parking":
        return <div className="space-y-3"><p className="text-sm">Guarda tu estacionamiento actual para probar.</p><Button asChild><Link to="/app/parking/new">Guardar estacionamiento ahora</Link></Button></div>;
      case "device":
        return <div className="space-y-3"><p className="text-sm">Si tienes un rastreador, vincúlalo para ver la ubicación en vivo.</p><Button asChild variant="outline"><Link to="/app/devices">Vincular dispositivo</Link></Button></div>;
      case "nav":
        return <p className="text-sm">Al volver, pulsa <strong>“Encontrar mi vehículo”</strong>. Verás instrucciones por nivel y, si el edificio tiene mapa, un plano con la ruta.</p>;
      default:
        return null;
    }
  };

  const onContinue = async () => {
    if (step.key === "type" && type === "business") {
      if (!orgName.trim()) { toast.error("Ingresa el nombre de la empresa"); return; }
      try { await org.create.mutateAsync({ name: orgName.trim() }); toast.success("Empresa creada"); } catch (e) { toast.error(errorMessage(e)); return; }
    }
    next();
  };

  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-2 text-sm text-muted-foreground">Paso {i + 1} de {steps.length}</p>
      <Progress value={((i + 1) / steps.length) * 100} className="mb-6" aria-label="Progreso" />
      <div className="surface-card p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand-gradient text-primary-foreground"><step.icon className="size-5" /></span>
          <h1 className="text-xl font-semibold">{step.title}</h1>
        </div>
        {body()}
        <div className="mt-6 flex justify-between gap-2">
          <Button variant="ghost" disabled={i === 0} onClick={() => setI(i - 1)}>Atrás</Button>
          <div className="flex gap-2">
            {step.optional && <Button variant="outline" onClick={next}>Omitir</Button>}
            {step.key !== "vehicle" && <Button onClick={onContinue} disabled={org.create.isPending}>{i === steps.length - 1 ? "Ir a mi panel" : "Continuar"}</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}
