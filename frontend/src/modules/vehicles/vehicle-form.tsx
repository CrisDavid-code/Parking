import { useForm, type FieldValues, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { FormFields, type FieldDef } from "@/components/common/form-dialog";
import { InlineSpinner } from "@/components/common/state-view";
import type { VehicleInput } from "./api";

export const vehicleSchema = z.object({
  alias: z.string().min(1, "Requerido").max(40),
  make: z.string().min(1, "Requerido"),
  model: z.string().min(1, "Requerido"),
  year: z.number({ invalid_type_error: "Año inválido" }).int().min(1950).max(new Date().getFullYear() + 1),
  color: z.string().min(1, "Requerido"),
  plate: z.string().max(15).optional().or(z.literal("")),
  photoUrl: z.string().url("URL inválida").optional().or(z.literal("")),
});
const fields: FieldDef[] = [
  { name: "alias", label: "Alias", placeholder: "Mi carro" },
  { name: "make", label: "Marca" },
  { name: "model", label: "Modelo" },
  { name: "year", label: "Año", type: "number" },
  { name: "color", label: "Color" },
  { name: "plate", label: "Placa (opcional)" },
  { name: "photoUrl", label: "URL de foto (opcional)" },
];

export function VehicleForm({ defaultValues, onSubmit, submitLabel = "Guardar" }: {
  defaultValues?: Partial<VehicleInput>; onSubmit: (v: VehicleInput) => Promise<unknown>; submitLabel?: string;
}) {
  const form = useForm<FieldValues>({ resolver: zodResolver(vehicleSchema) as unknown as Resolver<FieldValues>, defaultValues: defaultValues as FieldValues });
  return (
    <form noValidate className="space-y-5" onSubmit={form.handleSubmit(async (v) => {
      const d = v as VehicleInput;
      await onSubmit({ ...d, plate: d.plate || undefined, photoUrl: d.photoUrl || undefined });
    })}>
      <FormFields fields={fields} form={form} />
      <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting && <InlineSpinner />} {submitLabel}</Button>
    </form>
  );
}
