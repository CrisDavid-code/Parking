import { useState, type ReactNode } from "react";
import { useForm, type FieldValues, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/api/client";
import { InlineSpinner } from "./state-view";

export interface FieldDef {
  name: string;
  label: string;
  type?: "text" | "email" | "number" | "textarea" | "select" | "checkbox" | "datetime-local" | "password";
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export function FormFields({ fields, form }: { fields: FieldDef[]; form: ReturnType<typeof useForm<FieldValues>> }) {
  const { register, formState: { errors } } = form;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((f) => {
        const err = errors[f.name]?.message as string | undefined;
        const id = `f-${f.name}`;
        const wide = f.type === "textarea" ? "sm:col-span-2" : "";
        if (f.type === "checkbox")
          return (
            <label key={f.name} className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" className="size-4 accent-[var(--primary)]" {...register(f.name)} /> {f.label}
            </label>
          );
        return (
          <div key={f.name} className={`space-y-1.5 ${wide}`}>
            <Label htmlFor={id}>{f.label}</Label>
            {f.type === "textarea" ? (
              <Textarea id={id} placeholder={f.placeholder} aria-invalid={!!err} {...register(f.name)} />
            ) : f.type === "select" ? (
              <select id={id} aria-invalid={!!err} className="native-select" {...register(f.name)}>
                <option value="">Selecciona…</option>
                {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <Input id={id} type={f.type ?? "text"} placeholder={f.placeholder} aria-invalid={!!err}
                {...register(f.name, f.type === "number" ? { valueAsNumber: true } : undefined)} />
            )}
            {err && <p className="text-xs text-destructive">{err}</p>}
          </div>
        );
      })}
    </div>
  );
}

export function FormDialog<S extends z.ZodTypeAny>({
  title, description, trigger, fields, schema, defaultValues, onSubmit, submitLabel = "Guardar",
}: {
  title: string; description?: string; trigger: ReactNode; fields: FieldDef[]; schema: S;
  defaultValues?: Record<string, unknown> | undefined; onSubmit: (v: z.infer<S>) => Promise<unknown>; submitLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<FieldValues>({
    resolver: zodResolver(schema) as unknown as Resolver<FieldValues>,
    defaultValues: defaultValues as FieldValues,
  });
  const submit = form.handleSubmit(async (v) => {
    try {
      await onSubmit(v as z.infer<S>);
      toast.success("Guardado correctamente");
      setOpen(false);
      form.reset(defaultValues as FieldValues);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5" noValidate>
          <FormFields fields={fields} form={form} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <InlineSpinner />} {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
