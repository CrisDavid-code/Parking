import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/layout/public-layout";
import { brand } from "@/config/brand";

export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <aside className="hero-bg hidden flex-col justify-between p-10 md:flex">
        <Link to="/"><BrandMark light /></Link>
        <div>
          <p className="font-display text-3xl font-semibold">{brand.tagline}</p>
          <p className="mt-3 max-w-sm opacity-75">{brand.description}</p>
        </div>
        <p className="text-xs opacity-60">© {brand.name}</p>
      </aside>
      <main id="main" className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 md:hidden"><Link to="/"><BrandMark /></Link></div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 text-sm text-muted-foreground">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
