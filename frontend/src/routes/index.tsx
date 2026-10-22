import { createFileRoute, Link } from "@tanstack/react-router";
import { Car, Layers, MapPin, Navigation, ShieldCheck, Users } from "lucide-react";
import { PublicLayout } from "@/components/layout/public-layout";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { seo } from "@/lib/seo";
import hero from "@/assets/hero.svg";
import { PricingGrid } from "@/modules/subscriptions/pricing-grid";

export const Route = createFileRoute("/")({
  head: () => seo("Encuentra tu vehículo, siempre", brand.description),
  component: Landing,
});

const benefits = [
  { icon: MapPin, title: "Guarda tu estacionamiento", desc: "Ubicación GPS con precisión real, o nivel, fila y plaza a mano." },
  { icon: Navigation, title: "Encuentra tu vehículo", desc: "Instrucciones claras y navegación externa con Google Maps o Waze." },
  { icon: Layers, title: "Navega por niveles", desc: "Planos interiores por piso cuando el edificio tiene mapa disponible." },
  { icon: Car, title: "Gestiona tus vehículos", desc: "Varios vehículos, miembros, dispositivos y rastreo en un solo lugar." },
];

function Landing() {
  return (
    <PublicLayout>
      <section className="hero-bg relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <p className="mb-4 inline-flex rounded-full border border-night-foreground/20 px-3 py-1 text-xs font-medium">{brand.tagline}</p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-6xl">
              Nunca más olvides <span className="text-gradient">dónde estacionaste</span>.
            </h1>
            <p className="mt-5 max-w-lg text-lg opacity-80">
              {brand.name} guarda tu estacionamiento, te guía de regreso por niveles y te ayuda a gestionar tus vehículos o tu flota.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="shadow-glow"><Link to="/register">Comenzar gratis</Link></Button>
              <Button asChild size="lg" variant="outline" className="border-night-foreground/30 bg-transparent text-night-foreground hover:bg-night-foreground/10 hover:text-night-foreground"><Link to="/features">Ver funciones</Link></Button>
            </div>
          </div>
          <img src={hero} alt="Ilustración de un estacionamiento por niveles con una ruta hasta el vehículo" width={1280} height={1024} className="w-full rounded-3xl shadow-glow" />
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-center text-3xl font-semibold">Todo lo que necesitas para volver a tu vehículo</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((b) => (
            <article key={b.title} className="surface-card lift p-6">
              <span className="flex size-11 items-center justify-center rounded-xl bg-brand-gradient text-primary-foreground"><b.icon className="size-5" aria-hidden /></span>
              <h3 className="mt-4 font-semibold">{b.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{b.desc}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="bg-card py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-semibold">Planes</h2>
          <div className="mt-10"><PricingGrid /></div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-20 md:grid-cols-2">
        <div className="surface-card p-8">
          <ShieldCheck className="size-8 text-teal" aria-hidden />
          <h2 className="mt-4 text-2xl font-semibold">Privacidad primero</h2>
          <p className="mt-2 text-muted-foreground">Pedimos tu ubicación solo cuando la usas. Exporta o elimina tus datos cuando quieras.</p>
          <Button asChild variant="link" className="px-0"><Link to="/security">Cómo protegemos tus datos</Link></Button>
        </div>
        <div className="surface-card p-8">
          <Users className="size-8 text-primary" aria-hidden />
          <h2 className="mt-4 text-2xl font-semibold">Para empresas</h2>
          <p className="mt-2 text-muted-foreground">Flota, conductores, asignaciones, geocercas, alertas y reportes.</p>
          <Button asChild variant="link" className="px-0"><Link to="/pricing">Ver plan Empresa</Link></Button>
        </div>
      </section>
    </PublicLayout>
  );
}
