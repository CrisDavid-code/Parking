import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { IndoorMap, NavigationSession, NavMode, NavRoute } from "@/types/api";

export const useIndoorMap = (buildingId?: string | null) =>
  useQuery({ queryKey: ["indoor-map", buildingId], queryFn: () => api.get<IndoorMap>(`/indoor-maps/${buildingId}`), enabled: !!buildingId });
export const useNavSession = (id: string) =>
  useQuery({ queryKey: ["nav-session", id], queryFn: () => api.get<NavigationSession>(`/navigation/sessions/${id}`) });

export function useNavMutations(sessionId?: string) {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ["nav-session", sessionId] });
  return {
    start: useMutation({ mutationFn: (d: { parkingSessionId: string; mode: NavMode }) => api.post<NavigationSession>("/navigation/sessions", d) }),
    route: useMutation({
      mutationFn: (d: { buildingId: string; fromNodeId: string; toNodeId: string; accessibleOnly?: boolean | undefined }) => api.post<NavRoute>("/navigation/route", d),
    }),
    position: useMutation({ mutationFn: (d: { levelId?: string | undefined; nodeId?: string | undefined }) => api.post(`/navigation/sessions/${sessionId}/position`, d), onSuccess: inv }),
    confirm: useMutation({ mutationFn: (nodeId: string) => api.post<NavigationSession>(`/navigation/sessions/${sessionId}/confirm-landmark`, { nodeId }), onSuccess: inv }),
    end: useMutation({ mutationFn: () => api.post(`/navigation/sessions/${sessionId}/end`), onSuccess: inv }),
  };
}
