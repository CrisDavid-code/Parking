import { useState, type ReactNode } from "react";
import { Link, Outlet, useNavigate, type LinkProps } from "@tanstack/react-router";
import { Bell, LogOut, Menu, type LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/modules/auth/auth-context";
import { useT, type MessageKey } from "@/config/i18n";
import { api } from "@/lib/api/client";
import type { Paginated, Notification, Role } from "@/types/api";
import { BrandMark } from "./public-layout";
import { StateView } from "@/components/common/state-view";

export interface NavItem {
  to: NonNullable<LinkProps["to"]>;
  label: MessageKey;
  icon: LucideIcon;
  exact?: boolean | undefined;
}

export function RequireAuth({ roles, children }: { roles?: Role[] | undefined; children: ReactNode }) {
  const { status, hasRole } = useAuth();
  if (status === "loading") return <div className="mx-auto max-w-3xl p-8"><StateView kind="loading" /></div>;
  if (status === "expired") return <div className="p-8"><StateView kind="expired" /></div>;
  if (status === "anonymous")
    return (
      <div className="p-8">
        <StateView kind="expired" title="Inicia sesión" description="Necesitas una cuenta para acceder a esta sección." />
      </div>
    );
  if (roles && !hasRole(...roles))
    return (
      <div className="p-8">
        <StateView kind="forbidden" description="Tu rol no tiene acceso a esta área."
          action={<Button asChild variant="outline" size="sm"><Link to="/app">Volver a mi panel</Link></Button>} />
      </div>
    );
  return <>{children}</>;
}

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: (() => void) | undefined }) {
  const t = useT();
  return (
    <ul className="space-y-0.5">
      {items.map((i) => (
        <li key={String(i.to)}>
          <Link to={i.to} onClick={onNavigate} activeOptions={{ exact: !!i.exact }}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground [&>svg]:text-sidebar-primary" }}>
            <i.icon className="size-4" aria-hidden /> {t(i.label)}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function AppShell({ nav, mobileNav, areaLabel, roles, switcher }: {
  nav: NavItem[]; mobileNav?: NavItem[] | undefined; areaLabel: string; roles?: Role[] | undefined; switcher?: ReactNode;
}) {
  const { user, logout } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const unread = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => api.get<Paginated<Notification>>("/notifications", { page: 1, pageSize: 1, unread: true }),
    enabled: !!user,
    refetchInterval: 60_000,
  });
  const doLogout = async () => {
    await logout();
    navigate({ to: "/login" });
  };
  const sidebar = (close?: () => void) => (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link to="/" onClick={close}><BrandMark light /></Link>
      <p className="px-3 text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/60">{areaLabel}</p>
      <nav aria-label={areaLabel} className="-mt-4 flex-1 overflow-y-auto"><NavLinks items={nav} onNavigate={close} /></nav>
      {switcher}
      <div className="border-t border-sidebar-border pt-4 text-sm text-sidebar-foreground">
        <p className="truncate font-medium text-sidebar-accent-foreground">{user?.fullName}</p>
        <p className="truncate text-xs">{user?.email}</p>
        <button onClick={doLogout} className="mt-3 flex items-center gap-2 text-xs hover:text-sidebar-accent-foreground">
          <LogOut className="size-3.5" aria-hidden /> {t("common.logout")}
        </button>
      </div>
    </div>
  );
  return (
    <RequireAuth roles={roles}>
      <div className="flex min-h-[calc(100vh-0px)]">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 bg-sidebar md:block">{sidebar()}</aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border bg-background/85 px-4 backdrop-blur">
            <div className="flex items-center gap-2 md:hidden">
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild><Button variant="ghost" size="icon" aria-label="Abrir menú"><Menu className="size-5" /></Button></SheetTrigger>
                <SheetContent side="left" className="w-72 border-0 bg-sidebar p-0">
                  <SheetHeader className="sr-only"><SheetTitle>Menú</SheetTitle></SheetHeader>
                  {sidebar(() => setOpen(false))}
                </SheetContent>
              </Sheet>
              <BrandMark />
            </div>
            <span className="hidden text-sm text-muted-foreground md:block">{areaLabel}</span>
            <Button asChild variant="ghost" size="icon" aria-label="Notificaciones" className="relative">
              <Link to="/app/notifications">
                <Bell className="size-5" />
                {!!unread.data?.total && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-teal" aria-label={`${unread.data.total} sin leer`} />}
              </Link>
            </Button>
          </header>
          <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24 md:pb-8">
            <Outlet />
          </main>
          {mobileNav && (
            <nav aria-label="Navegación inferior" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-card/95 backdrop-blur md:hidden">
              {mobileNav.map((i) => (
                <Link key={String(i.to)} to={i.to} activeOptions={{ exact: !!i.exact }}
                  className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground"
                  activeProps={{ className: "text-primary" }}>
                  <i.icon className="size-5" aria-hidden /> {t(i.label)}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </div>
    </RequireAuth>
  );
}
