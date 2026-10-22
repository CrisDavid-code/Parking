import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Crosshair, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InlineSpinner } from "@/components/common/state-view";
import { useGeolocation } from "@/modules/maps/use-geolocation";
import type { ParkingSession, Vehicle } from "@/types/api";
import { PRESET_LEVELS, useBuildings, useLevels, type ParkingInput } from "./api";

const opt = z.string().max(80).optional().or(z.literal(""));
const schema = z.object({
  vehicleId: z.string().min(1, "Selecciona un vehículo"),
  buildingId: opt,
  levelPreset: opt,
  levelOther: opt,
  levelId: opt,
  zone: opt,
  row: opt,
  spot: opt,
  entrance: opt,
  referencePoint: opt,
  referenceType: z.enum(["", "elevator", "stairs", "ramp", "other"]).optional(),
  ticketNumber: opt,
  address: opt,
  notes: z.string().max(500).optional().or(z.literal("")),
});
type Values = z.infer<typeof schema>;

export function ParkingForm({
  vehicles,
  initial,
  onSubmit,
  submitLabel = "Guardar estacionamiento",
}: {
  vehicles: Vehicle[];
  initial?: Partial<ParkingSession>;
  submitLabel?: string;
  onSubmit: (d: ParkingInput, files: File[]) => Promise<unknown>;
}) {
  const geo = useGeolocation();
  const [files, setFiles] = useState<File[]>([]);
  const preset =
    initial?.levelLabel && (PRESET_LEVELS as readonly string[]).includes(initial.levelLabel)
      ? initial.levelLabel
      : initial?.levelLabel
        ? "other"
        : "";
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      vehicleId:
        initial?.vehicleId ?? vehicles.find((v) => v.isPrimary)?.id ?? vehicles[0]?.id ?? "",
      buildingId: initial?.buildingId ?? "",
      levelPreset: preset,
      levelOther: preset === "other" ? (initial?.levelLabel ?? "") : "",
      levelId: initial?.levelId ?? "",
      zone: initial?.zone ?? "",
      row: initial?.row ?? "",
      spot: initial?.spot ?? "",
      entrance: initial?.entrance ?? "",
      referencePoint: initial?.referencePoint ?? "",
      referenceType: initial?.referenceType ?? "",
      ticketNumber: initial?.ticketNumber ?? "",
      address: initial?.address ?? "",
      notes: initial?.notes ?? "",
    },
  });
  const buildingId = form.watch("buildingId");
  const levelPreset = form.watch("levelPreset");
  const buildings = useBuildings();
  const levels = useLevels(buildingId || null);
  const fix = geo.fix;
  const hasCoords = fix || (initial?.latitude != null && initial?.longitude != null);

  const submit = form.handleSubmit(async (v) => {
    const levelFromBuilding = levels.data?.find((l) => l.id === v.levelId);
    const levelLabel =
      levelFromBuilding?.code ??
      (v.levelPreset === "other" ? v.levelOther : v.levelPreset) ??
      undefined;
    const e = (s?: string) => (s ? s : undefined);
    await onSubmit(
      {
        vehicleId: v.vehicleId,
        latitude: fix?.lat ?? initial?.latitude ?? undefined,
        longitude: fix?.lng ?? initial?.longitude ?? undefined,
        accuracyMeters: fix?.accuracy ?? initial?.accuracyMeters ?? undefined,
        source: fix ? "gps" : (initial?.source ?? "manual"),
        buildingId: e(v.buildingId),
        levelId: e(v.levelId),
        levelLabel: e(levelLabel),
        zone: e(v.zone),
        row: e(v.row),
        spot: e(v.spot),
        entrance: e(v.entrance),
        referencePoint: e(v.referencePoint),
        referenceType: v.referenceType ? v.referenceType : undefined,
        ticketNumber: e(v.ticketNumber),
        address: e(v.address),
        notes: e(v.notes),
      },
      files,
    );
  });
  const r = form.register;
  const err = form.formState.errors;
  const txt = (name: keyof Values, label: string, ph?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} placeholder={ph} {...r(name)} />
    </div>
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <section className="surface-card space-y-4 p-5">
        <h2 className="font-semibold">Ubicación</h2>
        <div className="space-y-1.5">
          <Label htmlFor="vehicleId">Vehículo</Label>
          <select id="vehicleId" className="native-select" {...r("vehicleId")}>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.alias}
              </option>
            ))}
          </select>
          {err.vehicleId && <p className="text-xs text-destructive">{err.vehicleId.message}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => geo.request()}
            disabled={geo.state === "requesting"}
          >
            {geo.state === "requesting" ? <InlineSpinner /> : <Crosshair className="size-4" />} Usar
            mi ubicación
          </Button>
          {fix && (
            <span className="text-sm" role="status">
              Ubicación obtenida · precisión <strong>±{Math.round(fix.accuracy)} m</strong>
            </span>
          )}
          {!fix && initial?.latitude != null && (
            <span className="text-sm text-muted-foreground">
              Coordenadas guardadas · ±{Math.round(initial.accuracyMeters ?? 0)} m
            </span>
          )}
        </div>
        {geo.state === "denied" && (
          <Alert variant="destructive">
            <AlertDescription>
              Permiso de ubicación denegado. Puedes registrar el lugar manualmente abajo.
            </AlertDescription>
          </Alert>
        )}
        {(geo.state === "unavailable" || geo.state === "error") && (
          <Alert>
            <AlertDescription>
              No se pudo obtener la ubicación. Usa el registro manual.
            </AlertDescription>
          </Alert>
        )}
        {fix && fix.accuracy > 50 && (
          <Alert>
            <AlertDescription>
              La precisión es baja (±{Math.round(fix.accuracy)} m). Completa nivel y plaza para
              encontrarlo mejor.
            </AlertDescription>
          </Alert>
        )}
        {!hasCoords && (
          <p className="text-xs text-muted-foreground">
            Sin coordenadas: se guardará solo la información manual.
          </p>
        )}
        {txt("address", "Dirección o lugar (opcional)", "Centro comercial, calle…")}
      </section>

      <section className="surface-card grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">Dentro del estacionamiento</h2>
        <div className="space-y-1.5">
          <Label htmlFor="buildingId">Edificio</Label>
          <select
            id="buildingId"
            className="native-select"
            {...r("buildingId")}
            disabled={buildings.isPending}
          >
            <option value="">{buildings.isError ? "No disponible" : "Ninguno / no listado"}</option>
            {buildings.data?.items.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        {buildingId && levels.data && levels.data.length > 0 ? (
          <div className="space-y-1.5">
            <Label htmlFor="levelId">Nivel</Label>
            <select id="levelId" className="native-select" {...r("levelId")}>
              <option value="">Selecciona…</option>
              {levels.data.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} — {l.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="levelPreset">Nivel</Label>
            <select id="levelPreset" className="native-select" {...r("levelPreset")}>
              <option value="">Selecciona…</option>
              {PRESET_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
              <option value="other">Otro</option>
            </select>
          </div>
        )}
        {levelPreset === "other" &&
          !levels.data?.length &&
          txt("levelOther", "Nombre del nivel", "Ej. Nivel 4, Azotea")}
        {txt("zone", "Zona", "Ej. Azul")}
        {txt("row", "Fila", "Ej. C")}
        {txt("spot", "Plaza", "Ej. 148")}
        {txt("entrance", "Entrada", "Ej. Norte")}
        <div className="space-y-1.5">
          <Label htmlFor="referenceType">Tipo de referencia</Label>
          <select id="referenceType" className="native-select" {...r("referenceType")}>
            <option value="">Ninguna</option>
            <option value="elevator">Ascensor</option>
            <option value="stairs">Escalera</option>
            <option value="ramp">Rampa</option>
            <option value="other">Otra</option>
          </select>
        </div>
        {txt("referencePoint", "Referencia", "Ej. Ascensor A")}
        {txt("ticketNumber", "Número de boleto")}
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="notes">Notas</Label>
          <Textarea id="notes" {...r("notes")} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="photos" className="flex items-center gap-2">
            <ImagePlus className="size-4" /> Fotos
          </Label>
          <Input
            id="photos"
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          {files.length > 0 && (
            <p className="text-xs text-muted-foreground">{files.length} foto(s) seleccionadas</p>
          )}
        </div>
      </section>
      <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting && <InlineSpinner />} {submitLabel}
      </Button>
    </form>
  );
}
