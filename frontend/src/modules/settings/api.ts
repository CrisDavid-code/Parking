import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { User } from "@/types/api";

export const useUpdateProfile = () => useMutation({ mutationFn: (d: { fullName: string }) => api.patch<User>("/users/me", d) });
export const exportMyData = () => api.get<unknown>("/users/me/export");
export const deleteMyAccount = () => api.delete("/users/me");
export { usePreferences } from "@/config/i18n";
