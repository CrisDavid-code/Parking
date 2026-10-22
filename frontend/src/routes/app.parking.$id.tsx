import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ExternalLink, Pencil, Square, Trash2 } from "lucide-react";
import { useParkingSession, useParkingMutations, describeSpot } from "@/modules/parking/api";
import { useVehicles } from "@/modules/vehicles/api";
import { ParkingForm } from "@/modules/parking/parking-form";
import { MapView } from "@/modules/maps/map-view";
import { StartNavigationButton } from "@/modules/indoor-navigation/start-button";
import { PageHeader, Section, Field } from "@/components/common/page-header";
import { QueryView } from "@/components/common/query-view";
import { StateView } from "@/components/common/state-view";
import { ConfirmButton } from "@/components/common/confirm-button";
import { FreshnessBadge, StatusBadge } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/api/client";
import { externalNav, useFormat } from "@/lib/format";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/app/parking/$id")({
  head: () => seo("Detalle de estacionamiento"),
  component: ParkingDetail,
});

const refLabel = {
  elevator: "Ascensor",
  stairs: "Escalera",
  ramp: "Rampa",
  other: "Otra",
} as const;

function ParkingDetail() {
  const { id } = Route.useParams();
  const q = useParkingSession(id);
  const vehicles = useVehicles();
  const m = useParkingMutations();
  const f = useFormat();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  return (
    <QueryView query={q}>
      {(s) => {
        const hasCoords = s.latitude != null && s.longitude != null;
        return (
          <>
            <PageHeader
              title={describeSpot(s)}
              description={`${s.address ?? "Sin dirección"} · ${f.date(s.startedAt)}`}
              actions={
                <>
                  <StatusBadge value={s.status} />
                  {s.status === "active" && (
                    <StartNavigationButton parkingSessionId={s.id} label="Encontrar mi vehículo" />
                  )}
                  <Button variant="outline" onClick={() => setEditing((e) => !e)}>
                    <Pencil className="size-4" /> {editing ? "Cerrar edición" : "Editar"}
                  </Button>
                  {s.status === "active" && (
                    <ConfirmButton
                      title="Finalizar estacionamiento"
                      description="Marcarás que ya recogiste tu vehículo."
                      successMessage="Estacionamiento finalizado"
                      trigger={
                        <Button variant="secondary">
                          <Square className="size-4" /> Finalizar
                        </Button>
                      }
                      onConfirm={() => m.end.mutateAsync(s.id)}
                    />
                  )}
                  <ConfirmButton
                    title="Eliminar registro"
                    description="Esta acción no se puede deshacer."
                    successMessage="Registro eliminado"
                    trigger={
                      <Button variant="ghost" size="icon" aria-label="Eliminar">
                        <Trash2 className="size-4" />
                      </Button>
                    }
                    onConfirm={async () => {
                      await m.remove.mutateAsync(s.id);
                      navigate({ to: "/app/parking" });
                    }}
                  />
                </>
              }
            />
            {editing && vehicles.data ? (
              <ParkingForm
                vehicles={vehicles.data.items}
                initial={s}
                submitLabel="Guardar cambios"
                onSubmit={async (d, files) => {
                  try {
                    await m.update.mutateAsync({ id: s.id, ...d });
                    if (files.length) await m.upload.mutateAsync({ id: s.id, files });
                    toast.success("Cambios guardados");
                    setEditing(false);
                  } catch (e) {
                    toast.error(errorMessage(e));
                  }
                }}
              />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <Section title="Detalle">
                  <dl className="grid grid-cols-2 gap-4 text-sm">
                    <Field label="Nivel" value={s.levelLabel} />
                    <Field label="Zona" value={s.zone} />
                    <Field label="Fila" value={s.row} />
                    <Field label="Plaza" value={s.spot} />
                    <Field label="Entrada" value={s.entrance} />
                    <Field
                      label="Referencia"
                      value={
                        s.referencePoint
                          ? `${s.referenceType ? refLabel[s.referenceType] + " · " : ""}${s.referencePoint}`
                          : null
                      }
                    />
                    <Field label="Boleto" value={s.ticketNumber} />
                    <Field
                      label="Origen"
                      value={
                        s.source === "gps"
                          ? "GPS"
                          : s.source === "device"
                            ? "Dispositivo"
                            : "Manual"
                      }
                    />
                    <Field
                      label="Precisión"
                      value={s.accuracyMeters != null ? `±${Math.round(s.accuracyMeters)} m` : null}
                    />
                    <Field label="Finalizado" value={s.endedAt ? f.date(s.endedAt) : null} />
                    <div className="col-span-2">
                      <Field label="Notas" value={s.notes} />
                    </div>
                  </dl>
                </Section>
                <Section
                  title="Mapa"
                  actions={hasCoords ? <FreshnessBadge value="saved" /> : undefined}
                >
                  {hasCoords ? (
                    <>
                      <MapView
                        height={260}
                        markers={[
                          {
                            id: s.id,
                            lat: s.latitude!,
                            lng: s.longitude!,
                            label: describeSpot(s),
                            status: "saved",
                            accuracyMeters: s.accuracyMeters,
                          },
                        ]}
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button asChild variant="outline" size="sm">
                          <a
                            href={externalNav.google(s.latitude!, s.longitude!)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink className="size-4" /> Google Maps
                          </a>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                          <a
                            href={externalNav.waze(s.latitude!, s.longitude!)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink className="size-4" /> Waze
                          </a>
                        </Button>
                      </div>
                    </>
                  ) : (
                    <StateView
                      kind="unknown-position"
                      compact
                      description="Este registro no tiene coordenadas. Usa el detalle manual."
                    />
                  )}
                </Section>
                <Section title="Fotos">
                  {s.media.length === 0 ? (
                    <StateView kind="empty" compact description="Sin fotos adjuntas." />
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {s.media.map((md) => (
                        <img
                          key={md.id}
                          src={md.url}
                          alt="Foto del lugar de estacionamiento"
                          loading="lazy"
                          className="aspect-square rounded-lg object-cover"
                        />
                      ))}
                    </div>
                  )}
                </Section>
              </div>
            )}
          </>
        );
      }}
    </QueryView>
  );
}
