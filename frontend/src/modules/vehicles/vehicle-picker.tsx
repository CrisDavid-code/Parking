import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Vehicle } from "@/types/api";

export function VehiclePicker({
  vehicles,
  value,
  onChange,
}: {
  vehicles: Vehicle[];
  value?: string | undefined;
  onChange: (id: string) => void;
}) {
  return (
    <Select {...(value ? { value } : {})} onValueChange={onChange}>
      <SelectTrigger className="w-56" aria-label="Vehículo">
        <SelectValue placeholder="Selecciona vehículo" />
      </SelectTrigger>
      <SelectContent>
        {vehicles.map((v) => (
          <SelectItem key={v.id} value={v.id}>
            {v.alias}
            {v.isPrimary ? " (principal)" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
