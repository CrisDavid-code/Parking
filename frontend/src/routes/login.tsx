import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AuthCard } from "@/modules/auth/auth-card";
import { useAuth } from "@/modules/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InlineSpinner } from "@/components/common/state-view";
import { errorMessage } from "@/lib/api/client";
import { seo } from "@/lib/seo";

const schema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(1, "Requerido"),
});

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } =>
    typeof s["redirect"] === "string" ? { redirect: s["redirect"] } : {},
  head: () => seo("Iniciar sesión"),
  component: Login,
});

function Login() {
  const { login, status } = useAuth();
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await login(v.email, v.password);
      toast.success("Bienvenido");
      if (redirect?.startsWith("/")) window.location.assign(redirect);
      else navigate({ to: "/app" });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });
  const err = form.formState.errors;
  return (
    <AuthCard
      title="Iniciar sesión"
      subtitle="Accede a tus vehículos y estacionamientos."
      footer={
        <>
          ¿No tienes cuenta?{" "}
          <Link to="/register" className="font-medium text-primary">
            Regístrate
          </Link>
        </>
      }
    >
      {status === "expired" && (
        <Alert className="mb-4">
          <AlertDescription>Tu sesión expiró. Vuelve a iniciar sesión.</AlertDescription>
        </Alert>
      )}
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Correo</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={!!err.email}
            {...form.register("email")}
          />
          {err.email && <p className="text-xs text-destructive">{err.email.message}</p>}
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <Label htmlFor="password">Contraseña</Label>
            <Link to="/forgot-password" className="text-xs text-primary">
              ¿La olvidaste?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!err.password}
            {...form.register("password")}
          />
          {err.password && <p className="text-xs text-destructive">{err.password.message}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <InlineSpinner />} Ingresar
        </Button>
      </form>
    </AuthCard>
  );
}
