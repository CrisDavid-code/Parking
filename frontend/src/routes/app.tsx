import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bell, Car, Cpu, CreditCard, History, Home, LifeBuoy, Map, MapPin, Navigation, Radar, Receipt, Settings, Share2, Shield, Building2, ShieldCheck,
} from "lucide-react";
import { AppShell, type NavItem } from "@/components/layout/app-shell";
import { useAuth } from "@/modules/auth/auth-context";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/app")({
  head: () => seo("Mi panel"),
  component: AppLayout,
});

const nav: NavItem[] = [
  { to: "/app", label: "nav.dashboard", icon: Home, exact: true },
  { to: "/app/map", label: "nav.map", icon: Map },
  { to: "/app/parking", label: "nav.parking", icon: MapPin },
  { to: "/app/navigation", label: "nav.navigation", icon: Navigation },
  { to: "/app/vehicles", label: "nav.vehicles", icon: Car },
  { to: "/app/tracking", label: "nav.tracking", icon: Radar },
  { to: "/app/devices", label: "nav.devices", icon: Cpu },
  { to: "/app/history", label: "nav.history", icon: History },
  { to: "/app/sharing", label: "nav.sharing", icon: Share2 },
  { to: "/app/notifications", label: "nav.notifications", icon: Bell },
  { to: "/app/subscription", label: "nav.subscription", icon: CreditCard },
  { to: "/app/billing", label: "nav.billing", icon: Receipt },
  { to: "/app/settings", label: "nav.settings", icon: Settings },
  { to: "/app/privacy", label: "nav.privacy", icon: Shield },
  { to: "/app/support", label: "nav.support", icon: LifeBuoy },
];
const mobile: NavItem[] = nav.filter((_, i) => [0, 1, 2, 4, 12].includes(i));

function AppLayout() {
  const { hasRole } = useAuth();
  const switcher = (hasRole("ORG_ADMIN", "ORG_MEMBER") || hasRole("PLATFORM_ADMIN")) && (
    <div className="space-y-1 border-t border-sidebar-border pt-3 text-sm">
      {hasRole("ORG_ADMIN", "ORG_MEMBER") && (
        <Link to="/business" className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sidebar-foreground hover:bg-sidebar-accent"><Building2 className="size-4" /> Empresa</Link>
      )}
      {hasRole("PLATFORM_ADMIN") && (
        <Link to="/admin" className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sidebar-foreground hover:bg-sidebar-accent"><ShieldCheck className="size-4" /> Administración</Link>
      )}
    </div>
  );
  return <AppShell nav={nav} mobileNav={mobile} areaLabel="Mi cuenta" switcher={switcher || undefined} />;
}
