import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/public-layout";
import { PricingGrid } from "@/modules/subscriptions/pricing-grid";
import { Button } from "@/components/ui/button";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/pricing")({
  head: () => seo("Precios", "Planes Gratis, Plus, Rastreo y Empresa."),
  component: () => (
    <PublicLayout>
      <div className="mx-auto max-w-6xl px-4 py-16">
        <h1 className="text-4xl font-bold">Precios</h1>
        <p className="mt-2 text-muted-foreground">
          Precios y límites obtenidos directamente de nuestro servicio.
        </p>
        <div className="mt-10">
          <PricingGrid
            action={() => (
              <Button asChild className="w-full">
                <Link to="/register">Elegir</Link>
              </Button>
            )}
          />
        </div>
      </div>
    </PublicLayout>
  ),
});
