import { createFileRoute } from "@tanstack/react-router";
import { Bell, Building2, Camera, Car, Cpu, Layers, MapPin, Share2, Smartphone } from "lucide-react";
import { PublicLayout } from "@/components/layout/public-layout";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/features")({
  head: () => seo("Funciones", "Guardar estacionamiento, navegación por niveles, rastreo, compartir y gestión de flotas."),
  component: Features,
});

const items = [
  { icon: MapPin, t: "Estacionamiento con GPS o manual", d: "Precisión visible (±m), nivel, zona, fila, plaza, referencia y boleto." },
  { icon: Camera, t: "Fotos y notas", d: "Adjunta fotos del lugar para reconocerlo al volver." },
  { icon: Layers, t: "Navegación por niveles", d: "Modo básico con instrucciones, o plano interior cuando el edificio tiene mapa." },
  { icon: Smartphone, t: "Sensores y AR (app nativa)", d: "Preparado para la app móvil; en la web no se simulan sensores ni cámara." },
  { icon: Cpu, t: "Dispositivos de rastreo", d: "Vincula rastreadores y consulta la última ubicación con su frescura." },
  { icon: Share2, t: "Compartir con permisos", d: "Invita a familiares o compañeros con permisos y vencimiento." },
  { icon: Bell, t: "Notificaciones", d: "Alertas de dispositivos, geocercas y estacionamiento." },
  { icon: Car, t: "Varios vehículos", d: "Vehículo principal, miembros y historial por vehículo." },
  { icon: Building2, t: "Empresas", d: "Flota, conductores, asignaciones, geocercas, alertas y reportes." },
];

function Features() {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-6xl px-4 py-16">
        <h1 className="text-4xl font-bold">Funciones</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">Herramientas reales, sin promesas vacías: cada función indica cuándo depende de datos o hardware disponibles.</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((i) => (
            <article key={i.t} className="surface-card lift p-6">
              <i.icon className="size-6 text-primary" aria-hidden />
              <h2 className="mt-3 font-semibold">{i.t}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{i.d}</p>
            </article>
          ))}
        </div>
      </div>
    </PublicLayout>
  );
}
