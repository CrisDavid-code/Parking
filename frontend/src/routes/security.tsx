import { createFileRoute } from "@tanstack/react-router";
import { Download, KeyRound, Lock, MapPin } from "lucide-react";
import { PublicLayout } from "@/components/layout/public-layout";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/security")({
  head: () => seo("Seguridad y privacidad", "Cómo protegemos tu ubicación y tus datos."),
  component: Security,
});
const points = [
  {
    icon: MapPin,
    t: "Ubicación bajo demanda",
    d: "Solo pedimos permiso de ubicación cuando tocas “Usar mi ubicación”.",
  },
  {
    icon: Lock,
    t: "Conexiones cifradas",
    d: "Toda la comunicación con el servicio viaja por HTTPS.",
  },
  {
    icon: KeyRound,
    t: "Tokens de dispositivo de un solo uso",
    d: "El token de un dispositivo se muestra una única vez y puede revocarse.",
  },
  {
    icon: Download,
    t: "Control de tus datos",
    d: "Exporta o elimina tu información desde Privacidad.",
  },
];
function Security() {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-4xl px-4 py-16">
        <h1 className="text-4xl font-bold">Seguridad</h1>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {points.map((p) => (
            <article key={p.t} className="surface-card p-6">
              <p.icon className="size-6 text-teal" aria-hidden />
              <h2 className="mt-3 font-semibold">{p.t}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{p.d}</p>
            </article>
          ))}
        </div>
      </div>
    </PublicLayout>
  );
}
