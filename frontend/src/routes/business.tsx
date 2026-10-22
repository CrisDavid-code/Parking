import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  BarChart3,
  Car,
  ClipboardList,
  Cpu,
  Home,
  Map,
  Settings,
  Target,
  UserCog,
  Users,
} from "lucide-react";
import { AppShell, type NavItem } from "@/components/layout/app-shell";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/business")({
  head: () => seo("Empresa"),
  component: BusinessLayout,
});

const nav: NavItem[] = [
  { to: "/business", label: "nav.dashboard", icon: Home, exact: true },
  { to: "/business/fleet", label: "nav.fleet", icon: Map },
  { to: "/business/vehicles", label: "nav.vehicles", icon: Car },
  { to: "/business/drivers", label: "nav.drivers", icon: UserCog },
  { to: "/business/assignments", label: "nav.assignments", icon: ClipboardList },
  { to: "/business/devices", label: "nav.devices", icon: Cpu },
  { to: "/business/geofences", label: "nav.geofences", icon: Target },
  { to: "/business/alerts", label: "nav.alerts", icon: AlertTriangle },
  { to: "/business/reports", label: "nav.reports", icon: BarChart3 },
  { to: "/business/members", label: "nav.members", icon: Users },
  { to: "/business/settings", label: "nav.settings", icon: Settings },
];
const mobile = nav.filter((_, i) => [0, 1, 2, 7, 8].includes(i));

function BusinessLayout() {
  return (
    <AppShell
      nav={[...nav, { to: "/app", label: "nav.more", icon: Home, exact: true }]}
      mobileNav={mobile}
      areaLabel="Empresa"
      roles={["ORG_ADMIN", "ORG_MEMBER", "PLATFORM_ADMIN"]}
    />
  );
}
