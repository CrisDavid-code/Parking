import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AuthCard } from "@/modules/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StateView } from "@/components/common/state-view";
import { api, errorMessage } from "@/lib/api/client";
import { seo } from "@/lib/seo";

const schema = z
  .object({
    password: z
      .string()
      .regex(/^(?=.*[A-Za-z])(?=.*\d).{10,128}$/, "Mínimo 10 caracteres, con letras y números"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Las contraseñas no coinciden",
    path: ["confirm"],
  });

export const Route = createFileRoute("/reset-password")({
  validateSearch: (s: Record<string, unknown>): { token?: string } =>
    typeof s["token"] === "string" ? { token: s["token"] } : {},
  head: () => seo("Restablecer contraseña"),
  component: Reset,
});

function Reset() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const e = form.formState.errors;
  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await api.post("/auth/reset-password", { token, password: v.password }, false);
      toast.success("Contraseña actualizada");
      navigate({ to: "/login" });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  });
  return (
    <AuthCard
      title="Nueva contraseña"
      footer={
        <Link to="/login" className="text-primary">
          Volver
        </Link>
      }
    >
      {!token ? (
        <StateView
          kind="error"
          title="Enlace inválido"
          description="El enlace no contiene un token válido."
        />
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" {...form.register("password")} />
            {e.password && <p className="text-xs text-destructive">{e.password.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirmar</Label>
            <Input id="confirm" type="password" {...form.register("confirm")} />
            {e.confirm && <p className="text-xs text-destructive">{e.confirm.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            Guardar
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
