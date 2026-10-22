import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Locale = "es" | "en";

const es = {
  "nav.dashboard": "Inicio",
  "nav.map": "Mapa",
  "nav.parking": "Estacionamiento",
  "nav.vehicles": "Vehículos",
  "nav.tracking": "Rastreo",
  "nav.devices": "Dispositivos",
  "nav.history": "Historial",
  "nav.sharing": "Compartir",
  "nav.notifications": "Notificaciones",
  "nav.subscription": "Suscripción",
  "nav.billing": "Facturación",
  "nav.settings": "Ajustes",
  "nav.privacy": "Privacidad",
  "nav.support": "Soporte",
  "nav.navigation": "Navegación",
  "nav.more": "Más",
  "nav.fleet": "Flota",
  "nav.drivers": "Conductores",
  "nav.assignments": "Asignaciones",
  "nav.geofences": "Geocercas",
  "nav.alerts": "Alertas",
  "nav.reports": "Reportes",
  "nav.members": "Miembros",
  "nav.users": "Usuarios",
  "nav.organizations": "Organizaciones",
  "nav.plans": "Planes",
  "nav.usage": "Uso",
  "nav.audit": "Auditoría",
  "nav.indoorMaps": "Mapas interiores",
  "nav.buildings": "Edificios",
  "common.logout": "Cerrar sesión",
  "common.retry": "Reintentar",
  "common.save": "Guardar",
  "common.cancel": "Cancelar",
  "common.delete": "Eliminar",
  "common.create": "Crear",
  "common.search": "Buscar",
  "demo.banner": "Modo demostración — datos ficticios",
  "offline.banner": "Sin conexión. Los datos pueden estar desactualizados.",
} as const;

export type MessageKey = keyof typeof es;

const en: Record<MessageKey, string> = {
  "nav.dashboard": "Home",
  "nav.map": "Map",
  "nav.parking": "Parking",
  "nav.vehicles": "Vehicles",
  "nav.tracking": "Tracking",
  "nav.devices": "Devices",
  "nav.history": "History",
  "nav.sharing": "Sharing",
  "nav.notifications": "Notifications",
  "nav.subscription": "Subscription",
  "nav.billing": "Billing",
  "nav.settings": "Settings",
  "nav.privacy": "Privacy",
  "nav.support": "Support",
  "nav.navigation": "Navigation",
  "nav.more": "More",
  "nav.fleet": "Fleet",
  "nav.drivers": "Drivers",
  "nav.assignments": "Assignments",
  "nav.geofences": "Geofences",
  "nav.alerts": "Alerts",
  "nav.reports": "Reports",
  "nav.members": "Members",
  "nav.users": "Users",
  "nav.organizations": "Organizations",
  "nav.plans": "Plans",
  "nav.usage": "Usage",
  "nav.audit": "Audit",
  "nav.indoorMaps": "Indoor maps",
  "nav.buildings": "Buildings",
  "common.logout": "Log out",
  "common.retry": "Retry",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.create": "Create",
  "common.search": "Search",
  "demo.banner": "Demo mode — fictitious data",
  "offline.banner": "You're offline. Data may be outdated.",
};

export const dictionaries: Record<Locale, Record<MessageKey, string>> = { es, en };

export interface Preferences {
  locale: Locale;
  currency: string;
  timeZone: string;
  dateFormat: "dd/MM/yyyy" | "MM/dd/yyyy" | "yyyy-MM-dd";
}
export const defaultPreferences: Preferences = {
  locale: "es",
  currency: "GTQ",
  timeZone: "America/Guatemala",
  dateFormat: "dd/MM/yyyy",
};
const PREFS_KEY = "app.preferences";

interface Ctx {
  prefs: Preferences;
  setPrefs: (p: Partial<Preferences>) => void;
  t: (k: MessageKey) => string;
}
const PrefsContext = createContext<Ctx | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setState] = useState<Preferences>(defaultPreferences);
  useEffect(() => {
    try {
      const s = localStorage.getItem(PREFS_KEY);
      if (s) setState({ ...defaultPreferences, ...(JSON.parse(s) as Partial<Preferences>) });
    } catch {
      /* ignore */
    }
  }, []);
  const value = useMemo<Ctx>(
    () => ({
      prefs,
      setPrefs: (p) =>
        setState((prev) => {
          const next = { ...prev, ...p };
          localStorage.setItem(PREFS_KEY, JSON.stringify(next));
          return next;
        }),
      t: (k) => dictionaries[prefs.locale][k] ?? k,
    }),
    [prefs],
  );
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePreferences() {
  const c = useContext(PrefsContext);
  if (!c) throw new Error("PreferencesProvider missing");
  return c;
}
export const useT = () => usePreferences().t;
