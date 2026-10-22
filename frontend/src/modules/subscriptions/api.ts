import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { Plan, PlanCode, Subscription } from "@/types/api";

export const usePlans = () =>
  useQuery({
    queryKey: ["plans"],
    queryFn: () => api.get<Plan[]>("/subscriptions/plans", undefined, false),
  });
export const useMySubscription = (enabled = true) =>
  useQuery({
    queryKey: ["subscription"],
    queryFn: () => api.get<Subscription>("/subscriptions/me"),
    enabled,
  });
export function useSubscriptionMutations() {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ["subscription"] });
  return {
    change: useMutation({
      mutationFn: (planCode: PlanCode) =>
        api.post<Subscription>("/subscriptions/change", { planCode }),
      onSuccess: inv,
    }),
    cancel: useMutation({
      mutationFn: () => api.post<Subscription>("/subscriptions/cancel"),
      onSuccess: inv,
    }),
  };
}

/** Beneficios descriptivos por plan (los precios y límites siempre vienen de la API). */
export const PLAN_FEATURES: Record<PlanCode, string[]> = {
  free: ["Guardar estacionamiento", "Navegación básica por niveles", "Historial corto"],
  plus: ["Varios vehículos", "Fotos y notas", "Compartir con familia"],
  tracking: ["Rastreo con dispositivo", "Historial de ubicaciones", "Alertas"],
  business: ["Gestión de flota", "Conductores y asignaciones", "Geocercas y reportes"],
};
