import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { useAuth } from "@/modules/auth/auth-context";
import type { Geofence, Organization, Paginated, ReportSummary, Vehicle } from "@/types/api";

export const useMyOrganizations = () => useQuery({ queryKey: ["organizations"], queryFn: () => api.get<Organization[]>("/organizations") });

/** Organización activa: la del usuario, si no la primera de /organizations */
export function useCurrentOrg() {
  const { user } = useAuth();
  const q = useMyOrganizations();
  const org = q.data?.find((o) => o.id === user?.organizationId) ?? q.data?.[0] ?? null;
  return { query: q, org, orgPath: org ? `/organizations/${org.id}` : null };
}

export const useOrgVehicles = (orgPath: string | null) =>
  useQuery({ queryKey: ["org", orgPath, "vehicles", "all"], queryFn: () => api.get<Paginated<Vehicle>>(`${orgPath}/vehicles`, { page: 1, pageSize: 200 }), enabled: !!orgPath });
export const useGeofences = (orgPath: string | null) =>
  useQuery({ queryKey: ["org", orgPath, "geofences"], queryFn: () => api.get<Paginated<Geofence>>(`${orgPath}/geofences`, { page: 1, pageSize: 200 }), enabled: !!orgPath });
export const useReportSummary = (orgPath: string | null, from: string, to: string) =>
  useQuery({ queryKey: ["org", orgPath, "summary", from, to], queryFn: () => api.get<ReportSummary>(`${orgPath}/reports/summary`, { from, to }), enabled: !!orgPath });

export function useOrgMutation<T>(fn: (body: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ["org"] }) });
}
export function useOrganizationMutations() {
  const qc = useQueryClient();
  return {
    create: useMutation({ mutationFn: (d: { name: string }) => api.post<Organization>("/organizations", d), onSuccess: () => qc.invalidateQueries({ queryKey: ["organizations"] }) }),
    update: useMutation({ mutationFn: ({ id, ...d }: { id: string; name: string }) => api.patch<Organization>(`/organizations/${id}`, d), onSuccess: () => qc.invalidateQueries({ queryKey: ["organizations"] }) }),
  };
}
