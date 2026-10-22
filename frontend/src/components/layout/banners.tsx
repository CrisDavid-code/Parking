import { useEffect, useState } from "react";
import { FlaskConical, WifiOff } from "lucide-react";
import { env } from "@/config/env";
import { useT } from "@/config/i18n";

export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function GlobalBanners() {
  const t = useT();
  const online = useOnline();
  return (
    <>
      {env.demoMode && (
        <div role="status" className="flex items-center justify-center gap-2 bg-warning px-3 py-1.5 text-xs font-semibold text-warning-foreground">
          <FlaskConical className="size-3.5" aria-hidden /> {t("demo.banner")}
        </div>
      )}
      {!online && (
        <div role="alert" className="flex items-center justify-center gap-2 bg-night px-3 py-1.5 text-xs text-night-foreground">
          <WifiOff className="size-3.5" aria-hidden /> {t("offline.banner")}
        </div>
      )}
    </>
  );
}
