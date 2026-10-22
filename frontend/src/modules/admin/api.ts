import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { AdminUsage, ServiceHealth } from "@/types/api";

export const useAdminUsage = () => useQuery({ queryKey: ["admin", "usage"], queryFn: () => api.get<AdminUsage>("/admin/usage") });
export const useAdminHealth = () =>
  useQuery({ queryKey: ["admin", "health"], queryFn: () => api.get<ServiceHealth>("/admin/health"), refetchInterval: 30_000 });
