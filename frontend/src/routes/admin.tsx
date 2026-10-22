import { createFileRoute } from "@tanstack/react-router";
import { Activity, Building, Building2, CreditCard, FileClock, Home, LifeBuoy, Map, Users } from "lucide-react";
import { AppShell, type NavItem } from "@/components/layout/app-shell";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/admin")({ head: () => seo("Administración"), component: AdminLayout });

const nav: NavItem[] = [
  { to: "/admin", label: "nav.dashboard", icon: Home, exact: true },
  { to: "/admin/users", label: "nav.users", icon: Users },
  { to: "/admin/organizations", label: "nav.organizations", icon: Building2 },
  { to: "/admin/plans", label: "nav.plans", icon: CreditCard },
  { to: "/admin/usage", label: "nav.usage", icon: Activity },
  { to: "/admin/audit", label: "nav.audit", icon: FileClock },
  { to: "/admin/support", label: "nav.support", icon: LifeBuoy },
  { to: "/admin/buildings", label: "nav.buildings", icon: Building },
  { to: "/admin/indoor-maps", label: "nav.indoorMaps", icon: Map },
];

function AdminLayout() {
  return <AppShell nav={[...nav, { to: "/app", label: "nav.more", icon: Home, exact: true }]} mobileNav={nav.filter((_, i) => [0, 1, 2, 4, 8].includes(i))} areaLabel="Administración" roles={["PLATFORM_ADMIN"]} />;
}
