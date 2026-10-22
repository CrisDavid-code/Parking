import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { Device, DeviceCreated, Paginated } from "@/types/api";

export const useDevices = (vehicleId?: string) =>
  useQuery({ queryKey: ["devices", vehicleId ?? "all"], queryFn: () => api.get<Paginated<Device>>("/devices", { page: 1, pageSize: 100, vehicleId }) });

export function useDeviceMutations() {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ["devices"] });
  return {
    create: useMutation({ mutationFn: (d: { name: string; type: string; serial: string; vehicleId?: string | undefined }) => api.post<DeviceCreated>("/devices", d), onSuccess: inv }),
    update: useMutation({ mutationFn: ({ id, ...d }: Partial<Device> & { id: string }) => api.patch<Device>(`/devices/${id}`, d), onSuccess: inv }),
    revoke: useMutation({ mutationFn: (id: string) => api.post(`/devices/${id}/revoke`), onSuccess: inv }),
    remove: useMutation({ mutationFn: (id: string) => api.delete(`/devices/${id}`), onSuccess: inv }),
  };
}
