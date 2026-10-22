import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { brand } from "@/config/brand";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/modules/auth/auth-context";

const links = [
  { to: "/features", label: "Funciones" },
  { to: "/pricing", label: "Precios" },
  { to: "/security", label: "Seguridad" },
  { to: "/help", label: "Ayuda" },
] as const;

export function BrandMark({ light }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <brand.Logo className="size-8" />
      <span className={`font-display text-lg font-bold tracking-tight ${light ? "text-night-foreground" : "text-foreground"}`}>{brand.name}</span>
    </span>
  );
}

export function PublicLayout({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" aria-label={`${brand.name} inicio`}><BrandMark /></Link>
          <nav aria-label="Principal" className="hidden gap-6 text-sm font-medium text-muted-foreground md:flex">
            {links.map((l) => (
              <Link key={l.to} to={l.to} className="transition-colors hover:text-foreground" activeProps={{ className: "text-foreground" }}>{l.label}</Link>
            ))}
          </nav>
          <div className="flex gap-2">
            {status === "authenticated" ? (
              <Button asChild size="sm"><Link to="/app">Ir a la app</Link></Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm"><Link to="/login">Ingresar</Link></Button>
                <Button asChild size="sm"><Link to="/register">Crear cuenta</Link></Button>
              </>
            )}
          </div>
        </div>
      </header>
      <main id="main" className="flex-1">{children}</main>
      <footer className="border-t border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm text-muted-foreground md:grid-cols-3">
          <div className="space-y-2">
            <BrandMark />
            <p>{brand.tagline}</p>
          </div>
          <nav aria-label="Pie" className="flex flex-col gap-1.5">
            {links.map((l) => <Link key={l.to} to={l.to} className="hover:text-foreground">{l.label}</Link>)}
          </nav>
          <p>© {new Date().getFullYear()} {brand.name}. Contacto: {brand.supportEmail}</p>
        </div>
      </footer>
    </div>
  );
}
