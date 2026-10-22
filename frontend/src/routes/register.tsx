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
import { InlineSpinner } from "@/components/common/state-view";
import { errorMessage } from "@/lib/api/client";
import { seo } from "@/lib/seo";

const schema = z.object({
  fullName: z.string().min(2, "Ingresa tu nombre"),
  email: z.string().email("Correo inválido"),
  password: z
    .string()
    .regex(/^(?=.*[A-Za-z])(?=.*\d).{10,128}$/, "Mínimo 10 caracteres, con letras y números"),
  accountType: z.enum(["personal", "business"]),
});

export const Route = createFileRoute("/register")({
  head: () => seo("Crear cuenta"),
  component: Register,
});

function Register() {
  const { register: signUp } = useAuth();
  const navigate = useNavigate();
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { accountType: "personal" },
  });
  const err = form.formState.errors;
  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await signUp(v);
      toast.success("Cuenta creada");
      navigate({ to: "/app/onboarding" });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });
  const type = form.watch("accountType");
  return (
    <AuthCard
      title="Crear cuenta"
      footer={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className="font-medium text-primary">
            Inicia sesión
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Tipo de cuenta</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["personal", "business"] as const).map((t) => (
              <label
                key={t}
                className={`cursor-pointer rounded-lg border p-3 text-sm transition ${type === t ? "border-primary bg-primary/5" : "border-border"}`}
              >
                <input
                  type="radio"
                  value={t}
                  className="sr-only"
                  {...form.register("accountType")}
                />
                <span className="font-medium">{t === "personal" ? "Personal" : "Empresa"}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {(["fullName", "email", "password"] as const).map((n) => (
          <div key={n} className="space-y-1.5">
            <Label htmlFor={n}>
              {n === "fullName" ? "Nombre completo" : n === "email" ? "Correo" : "Contraseña"}
            </Label>
            <Input
              id={n}
              type={n === "password" ? "password" : n === "email" ? "email" : "text"}
              aria-invalid={!!err[n]}
              {...form.register(n)}
            />
            {err[n] && <p className="text-xs text-destructive">{err[n]?.message}</p>}
          </div>
        ))}
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <InlineSpinner />} Crear cuenta
        </Button>
      </form>
    </AuthCard>
  );
}
