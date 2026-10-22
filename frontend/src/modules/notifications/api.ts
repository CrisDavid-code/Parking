import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { Notification, Paginated } from "@/types/api";

export const useNotifications = (pageSize = 30) =>
  useQuery({
    queryKey: ["notifications", "list", pageSize],
    queryFn: () => api.get<Paginated<Notification>>("/notifications", { page: 1, pageSize }),
  });
export function useNotificationMutations() {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ["notifications"] });
  return {
    read: useMutation({
      mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
      onSuccess: inv,
    }),
    readAll: useMutation({ mutationFn: () => api.post("/notifications/read-all"), onSuccess: inv }),
  };
}
