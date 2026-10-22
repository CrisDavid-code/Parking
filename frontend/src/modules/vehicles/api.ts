import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import type { Paginated, Vehicle, VehicleMember } from "@/types/api";

export type VehicleInput = Pick<Vehicle, "alias" | "make" | "model" | "year" | "color"> & { plate?: string | undefined; photoUrl?: string | undefined };

export const useVehicles = () =>
  useQuery({ queryKey: ["vehicles"], queryFn: () => api.get<Paginated<Vehicle>>("/vehicles", { page: 1, pageSize: 100 }) });
export const useVehicle = (id: string) =>
  useQuery({ queryKey: ["vehicles", id], queryFn: () => api.get<Vehicle>(`/vehicles/${id}`) });
export const useVehicleMembers = (id: string) =>
  useQuery({ queryKey: ["vehicles", id, "members"], queryFn: () => api.get<Paginated<VehicleMember>>(`/vehicles/${id}/members`) });

export function useVehicleMutations() {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ["vehicles"] });
  return {
    create: useMutation({ mutationFn: (d: VehicleInput) => api.post<Vehicle>("/vehicles", d), onSuccess: inv }),
    update: useMutation({ mutationFn: ({ id, ...d }: VehicleInput & { id: string }) => api.patch<Vehicle>(`/vehicles/${id}`, d), onSuccess: inv }),
    remove: useMutation({ mutationFn: (id: string) => api.delete(`/vehicles/${id}`), onSuccess: inv }),
    setPrimary: useMutation({ mutationFn: (id: string) => api.post(`/vehicles/${id}/primary`), onSuccess: inv }),
    addMember: useMutation({ mutationFn: ({ id, email }: { id: string; email: string }) => api.post(`/vehicles/${id}/members`, { email }), onSuccess: inv }),
    removeMember: useMutation({ mutationFn: ({ id, memberId }: { id: string; memberId: string }) => api.delete(`/vehicles/${id}/members/${memberId}`), onSuccess: inv }),
  };
}

const SEL_KEY = "app.selectedVehicle";
/** Vehículo seleccionado: elección guardada → principal → primero */
export function useSelectedVehicle() {
  const q = useVehicles();
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => setSel(localStorage.getItem(SEL_KEY)), []);
  const items = q.data?.items ?? [];
  const vehicle = items.find((v) => v.id === sel) ?? items.find((v) => v.isPrimary) ?? items[0] ?? null;
  return {
    query: q,
    vehicle,
    select: (id: string) => {
      localStorage.setItem(SEL_KEY, id);
      setSel(id);
    },
  };
}
