import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { Building, Level, Loose, Paginated, ParkingSession } from "@/types/api";

export type ParkingInput = Loose<Omit<ParkingSession, "id" | "status" | "media" | "startedAt" | "createdAt" | "endedAt">> & { vehicleId: string };

export const useParkingSessions = (params: Loose<{ vehicleId: string; status: string; page: number; pageSize: number }> = {}) =>
  useQuery({
    queryKey: ["parking", "list", params],
    queryFn: () => api.get<Paginated<ParkingSession>>("/parking-sessions", { page: 1, pageSize: 20, ...params }),
  });
export const useActiveParking = (vehicleId?: string | null) =>
  useQuery({
    queryKey: ["parking", "active", vehicleId],
    queryFn: () => api.get<ParkingSession | null>("/parking-sessions/active", { vehicleId: vehicleId ?? undefined }),
    enabled: !!vehicleId,
  });
export const useParkingSession = (id: string) =>
  useQuery({ queryKey: ["parking", id], queryFn: () => api.get<ParkingSession>(`/parking-sessions/${id}`) });

export function useParkingMutations() {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ["parking"] });
  return {
    create: useMutation({ mutationFn: (d: ParkingInput) => api.post<ParkingSession>("/parking-sessions", d), onSuccess: inv }),
    update: useMutation({ mutationFn: ({ id, ...d }: Loose<ParkingInput> & { id: string }) => api.patch<ParkingSession>(`/parking-sessions/${id}`, d), onSuccess: inv }),
    end: useMutation({ mutationFn: (id: string) => api.post<ParkingSession>(`/parking-sessions/${id}/end`), onSuccess: inv }),
    remove: useMutation({ mutationFn: (id: string) => api.delete(`/parking-sessions/${id}`), onSuccess: inv }),
    upload: useMutation({
      mutationFn: ({ id, files }: { id: string; files: File[] }) => {
        const fd = new FormData();
        files.forEach((f) => fd.append("files", f));
        return api.upload(`/parking-sessions/${id}/media`, fd);
      },
      onSuccess: inv,
    }),
  };
}

export const useBuildings = () =>
  useQuery({ queryKey: ["buildings"], queryFn: () => api.get<Paginated<Building>>("/buildings", { page: 1, pageSize: 100 }) });
export const useLevels = (buildingId?: string | null) =>
  useQuery({ queryKey: ["buildings", buildingId, "levels"], queryFn: () => api.get<Level[]>(`/buildings/${buildingId}/levels`), enabled: !!buildingId });

export const PRESET_LEVELS = ["PB", "B1", "B2", "B3"] as const;
export function describeSpot(p: Pick<ParkingSession, "levelLabel" | "zone" | "row" | "spot">) {
  return [p.levelLabel && `Nivel ${p.levelLabel}`, p.zone && `Zona ${p.zone}`, p.row && `Fila ${p.row}`, p.spot && `Plaza ${p.spot}`]
    .filter(Boolean)
    .join(" · ") || "Sin detalle de ubicación interior";
}
