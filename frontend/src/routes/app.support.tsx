import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { PageHeader, Section } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/api/client";
import { brand } from "@/config/brand";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/app/support")({
  head: () => seo("Soporte"),
  component: Support,
});
const schema = z.object({
  subject: z.string().min(3, "Requerido").max(120),
  message: z.string().min(10, "Describe el problema (mín. 10 caracteres)").max(2000),
});

function Support() {
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const e = form.formState.errors;
  const submit = form.handleSubmit(async (v) => {
    try {
      await api.post("/support/tickets", v);
      toast.success("Caso enviado. Te contactaremos por correo.");
      form.reset({ subject: "", message: "" });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  });
  return (
    <>
      <PageHeader title="Soporte" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Section title="Abrir un caso">
            <form onSubmit={submit} noValidate className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="subject">Asunto</Label>
                <Input id="subject" {...form.register("subject")} />
                {e.subject && <p className="text-xs text-destructive">{e.subject.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="message">Mensaje</Label>
                <Textarea id="message" rows={6} {...form.register("message")} />
                {e.message && <p className="text-xs text-destructive">{e.message.message}</p>}
              </div>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                Enviar
              </Button>
            </form>
          </Section>
        </div>
        <Section title="Otros canales">
          <p className="text-sm text-muted-foreground">Correo: {brand.supportEmail}</p>
          <Button asChild variant="link" className="px-0">
            <Link to="/help">Preguntas frecuentes</Link>
          </Button>
        </Section>
      </div>
    </>
  );
}
