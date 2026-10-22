import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { Paginated, Share, ShareInvitation, SharePermission } from "@/types/api";

export const PERMISSION_LABELS: Record<SharePermission, string> = {
  view_parking: "Ver estacionamiento",
  view_location: "Ver ubicación",
  alerts: "Recibir alertas",
  manage: "Administrar",
};
export const useShares = () =>
  useQuery({
    queryKey: ["shares"],
    queryFn: () => api.get<Paginated<Share>>("/shares", { page: 1, pageSize: 100 }),
  });
export const useInvitation = (token: string) =>
  useQuery({
    queryKey: ["invitation", token],
    queryFn: () => api.get<ShareInvitation>(`/shares/invitations/${token}`, undefined, false),
  });
export function useShareMutations() {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ["shares"] });
  return {
    create: useMutation({
      mutationFn: (d: {
        vehicleId: string;
        granteeEmail: string;
        permissions: SharePermission[];
        expiresAt?: string | undefined;
      }) => api.post<Share>("/shares", d),
      onSuccess: inv,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete(`/shares/${id}`),
      onSuccess: inv,
    }),
    accept: useMutation({
      mutationFn: (token: string) => api.post(`/shares/invitations/${token}/accept`),
      onSuccess: inv,
    }),
  };
}
