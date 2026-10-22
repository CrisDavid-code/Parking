import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AuthCard } from "@/modules/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage } from "@/lib/api/client";
import { seo } from "@/lib/seo";

const schema = z.object({ email: z.string().email("Correo inválido") });
export const Route = createFileRoute("/forgot-password")({
  head: () => seo("Recuperar contraseña"),
  component: Forgot,
});

function Forgot() {
  const [sent, setSent] = useState(false);
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await api.post("/auth/forgot-password", v, false);
      setSent(true);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });
  return (
    <AuthCard
      title="Recuperar contraseña"
      footer={
        <Link to="/login" className="text-primary">
          Volver a iniciar sesión
        </Link>
      }
    >
      {sent ? (
        <p role="status" className="surface-card p-4 text-sm">
          Si el correo existe, recibirás un enlace para restablecer tu contraseña.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              type="email"
              {...form.register("email")}
              aria-invalid={!!form.formState.errors.email}
            />
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            Enviar enlace
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
