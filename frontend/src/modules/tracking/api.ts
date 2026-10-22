import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, tokenStore } from "@/lib/api/client";
import { env } from "@/config/env";
import { computeFreshness } from "@/lib/format";
import type { LastLocation } from "@/types/api";

const POLL_MS = 15_000;

/** Última ubicación con WebSocket (/tracking, evento `location`) y fallback a polling de 15 s. */
export function useLastLocation(vehicleId?: string | null) {
  const qc = useQueryClient();
  const [wsOpen, setWsOpen] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const key = ["tracking", "last", vehicleId];

  useEffect(() => {
    if (!vehicleId || env.demoMode || typeof WebSocket === "undefined") return;
    let ws: WebSocket;
    try {
      ws = new WebSocket(
        `${env.wsUrl}/tracking?vehicleId=${vehicleId}&token=${tokenStore.getAccess() ?? ""}`,
      );
    } catch {
      return;
    }
    wsRef.current = ws;
    ws.onopen = () => setWsOpen(true);
    ws.onclose = () => setWsOpen(false);
    ws.onerror = () => setWsOpen(false);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as { event?: string; data?: LastLocation };
        if (msg.event === "location" && msg.data?.vehicleId === vehicleId)
          qc.setQueryData(["tracking", "last", vehicleId], msg.data);
      } catch {
        /* mensaje inválido */
      }
    };
    return () => ws.close();
  }, [vehicleId, qc]);

  const query = useQuery({
    queryKey: key,
    queryFn: () => api.get<LastLocation>(`/tracking/vehicles/${vehicleId}/last`),
    enabled: !!vehicleId,
    refetchInterval: wsOpen ? false : POLL_MS,
  });
  const freshness = query.data ? computeFreshness(query.data.capturedAt) : null;
  return { ...query, freshness, transport: wsOpen ? ("websocket" as const) : ("polling" as const) };
}

export const useLocationHistory = (vehicleId: string | undefined, from: string, to: string) =>
  useQuery({
    queryKey: ["tracking", "history", vehicleId, from, to],
    queryFn: () => api.get<LastLocation[]>(`/tracking/vehicles/${vehicleId}/history`, { from, to }),
    enabled: !!vehicleId,
  });
