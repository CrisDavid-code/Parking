import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, ArrowDown, ArrowUp, Camera, CheckCircle2, Compass, Footprints, Glasses, RotateCw, Square } from "lucide-react";
import { useNavSession, useIndoorMap, useNavMutations } from "@/modules/indoor-navigation/api";
import { FloorPlan, IsometricView } from "@/modules/indoor-navigation/floor-plan";
import { getSensorProvider } from "@/modules/sensors/provider";
import { useParkingSession, describeSpot, PRESET_LEVELS } from "@/modules/parking/api";
import { PageHeader, Section, Field } from "@/components/common/page-header";
import { StateView, ErrorState, InlineSpinner } from "@/components/common/state-view";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ApiError, errorMessage } from "@/lib/api/client";
import { useFormat } from "@/lib/format";
import type { IndoorMap, Level, NavMode, NavRoute, ParkingSession } from "@/types/api";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/app/navigation/$sessionId")({ head: () => seo("Navegando a tu vehículo"), component: NavSessionPage });

/** Orden aproximado para niveles sin geometría: 3,2,1,PB,B1,B2… */
function ordinalOf(code: string) {
  const c = code.toUpperCase();
  if (c === "PB" || c === "0") return 0;
  if (/^B\d+$/.test(c)) return -Number(c.slice(1));
  const n = Number(c.replace(/\D/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function NavSessionPage() {
  const { sessionId } = Route.useParams();
  const session = useNavSession(sessionId);
  const parking = useParkingSession(session.data?.parkingSessionId ?? "__none__");
  if (session.isPending || (session.data && parking.isPending)) return <StateView kind="loading" />;
  if (session.isError) return <ErrorState error={session.error} onRetry={() => session.refetch()} />;
  if (parking.isError || !parking.data) return <ErrorState error={parking.error} onRetry={() => parking.refetch()} />;
  return <Navigator sessionId={sessionId} initialMode={session.data.mode} confirmed={session.data.positionConfirmed} parking={parking.data} />;
}

function Navigator({ sessionId, initialMode, confirmed, parking }: { sessionId: string; initialMode: NavMode; confirmed: boolean; parking: ParkingSession }) {
  const [mode, setMode] = useState<NavMode>(initialMode);
  const indoor = useIndoorMap(parking.buildingId);
  const m = useNavMutations(sessionId);
  const navigate = useNavigate();
  const map = indoor.data;
  const noMap = !parking.buildingId || (indoor.error instanceof ApiError && indoor.error.status === 404);

  const levels: Level[] = useMemo(() => {
    if (map) return [...map.levels].sort((a, b) => b.ordinal - a.ordinal);
    const codes = new Set<string>(["3", "2", "1", ...PRESET_LEVELS]);
    if (parking.levelLabel) codes.add(parking.levelLabel);
    return [...codes].map((c) => ({ id: `code:${c}`, code: c, name: c === "PB" ? "Planta baja" : `Nivel ${c}`, ordinal: ordinalOf(c) })).sort((a, b) => b.ordinal - a.ordinal);
  }, [map, parking.levelLabel]);
  const targetLevel = levels.find((l) => l.id === parking.levelId) ?? levels.find((l) => l.code === parking.levelLabel) ?? null;
  const [currentLevelId, setCurrentLevelId] = useState<string | null>(null);
  const currentLevel = levels.find((l) => l.id === currentLevelId) ?? null;
  const [route, setRoute] = useState<NavRoute | null>(null);

  const report = (levelId: string) => {
    setCurrentLevelId(levelId);
    m.position.mutate({ levelId: levelId.startsWith("code:") ? undefined : levelId });
  };

  return (
    <>
      <PageHeader title="Encontrar mi vehículo" description={describeSpot(parking)}
        actions={<Button variant="outline" onClick={async () => {
          try { await m.end.mutateAsync(); toast.success("Navegación finalizada"); navigate({ to: "/app/parking/$id", params: { id: parking.id } }); }
          catch (e) { toast.error(errorMessage(e)); }
        }}><Square className="size-4" /> Finalizar</Button>} />

      {!confirmed && (
        <RecoveryPanel levels={levels} currentLevelId={currentLevelId} onLevel={report} map={map} mode={mode}
          onConfirmNode={async (nodeId) => { try { await m.confirm.mutateAsync(nodeId); toast.success("Punto confirmado"); } catch (e) { toast.error(errorMessage(e)); } }}
          onRecalc={() => setMode(map ? "indoor" : "basic")} />
      )}

      <Tabs value={mode} onValueChange={(v) => setMode(v as NavMode)}>
        <TabsList className="mb-4 w-full justify-start overflow-x-auto">
          <TabsTrigger value="basic">A · Básica</TabsTrigger>
          <TabsTrigger value="indoor">B · Interior</TabsTrigger>
          <TabsTrigger value="sensor">C · Sensores/AR</TabsTrigger>
        </TabsList>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <TabsContent value="basic" className="mt-0"><BasicMode parking={parking} levels={levels} currentLevel={currentLevel} targetLevel={targetLevel} onLevel={report} /></TabsContent>
            <TabsContent value="indoor" className="mt-0">
              {indoor.isPending && parking.buildingId ? <StateView kind="loading" /> : noMap || !map ? (
                <StateView kind="map-unavailable" className="surface-card" title="Plano interior no disponible"
                  description="Este edificio no tiene un mapa interior registrado. Usa la navegación básica."
                  action={<Button onClick={() => setMode("basic")}>Ir a modo básico</Button>} />
              ) : (
                <IndoorMode map={map} parking={parking} currentLevelId={currentLevelId} onLevel={report} route={route} setRoute={setRoute}
                  calc={(d) => m.route.mutateAsync({ buildingId: map.building.id, ...d })} calculating={m.route.isPending} />
              )}
            </TabsContent>
            <TabsContent value="sensor" className="mt-0"><SensorMode onFallback={(x) => setMode(x)} hasMap={!!map} /></TabsContent>
          </div>
          <div className="space-y-4">
            <Section title="Vista por niveles">
              <IsometricView levels={levels} currentLevelId={currentLevelId} targetLevelId={targetLevel?.id}
                routeLevelIds={route?.legs.map((l) => l.levelId) ?? (currentLevel && targetLevel ? levels.filter((l) => l.ordinal <= Math.max(currentLevel.ordinal, targetLevel.ordinal) && l.ordinal >= Math.min(currentLevel.ordinal, targetLevel.ordinal)).map((l) => l.id) : [])}
                illustrative={!map} />
            </Section>
            {parking.media[0] && (
              <Section title="Foto del lugar">
                <img id="parking-photo" src={parking.media[0].url} alt="Foto del lugar de estacionamiento" className="w-full rounded-lg object-cover" />
              </Section>
            )}
          </div>
        </div>
      </Tabs>
    </>
  );
}

function LevelPicker({ levels, value, onChange, label = "¿En qué nivel estás?" }: { levels: Level[]; value: string | null; onChange: (id: string) => void; label?: string }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {levels.map((l) => (
          <Button key={l.id} type="button" size="sm" variant={value === l.id ? "default" : "outline"} aria-pressed={value === l.id} onClick={() => onChange(l.id)}>{l.code}</Button>
        ))}
      </div>
    </fieldset>
  );
}

function RecoveryPanel({ levels, currentLevelId, onLevel, map, onConfirmNode, onRecalc, mode }: {
  levels: Level[]; currentLevelId: string | null; onLevel: (id: string) => void; map?: IndoorMap | undefined; mode: NavMode;
  onConfirmNode: (id: string) => void; onRecalc: () => void;
}) {
  const landmarks = map?.nodes.filter((n) => n.levelId === currentLevelId && ["elevator", "stairs", "ramp", "entrance", "landmark"].includes(n.type)) ?? [];
  return (
    <Alert className="mb-4 border-warning bg-warning/10">
      <AlertTriangle className="size-4" />
      <AlertTitle>Posición no confirmada</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>No conocemos tu posición exacta dentro del edificio. Ayúdanos a ubicarte:</p>
        <LevelPicker levels={levels} value={currentLevelId} onChange={onLevel} />
        {map && currentLevelId && (
          landmarks.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <span className="text-sm">Estoy junto a:</span>
              {landmarks.map((n) => <Button key={n.id} size="sm" variant="secondary" onClick={() => onConfirmNode(n.id)}>{n.label}</Button>)}
            </div>
          ) : <p className="text-sm">No hay puntos conocidos registrados en este nivel.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onRecalc} disabled={mode === "sensor"}><RotateCw className="size-3.5" /> Recalcular</Button>
          <Button size="sm" variant="outline" onClick={() => document.getElementById("parking-photo")?.scrollIntoView({ behavior: "smooth" })}><Camera className="size-3.5" /> Volver a la foto</Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

function BasicMode({ parking, levels, currentLevel, targetLevel, onLevel }: {
  parking: ParkingSession; levels: Level[]; currentLevel: Level | null; targetLevel: Level | null; onLevel: (id: string) => void;
}) {
  const f = useFormat();
  const ref = parking.referencePoint ?? (parking.referenceType === "elevator" ? "el ascensor" : parking.referenceType === "stairs" ? "las escaleras" : parking.referenceType === "ramp" ? "la rampa" : null);
  const steps: { icon: typeof ArrowDown; text: string }[] = [];
  if (!currentLevel) steps.push({ icon: Compass, text: "Indica en qué nivel te encuentras para darte instrucciones." });
  else if (targetLevel && currentLevel.id !== targetLevel.id) {
    const down = currentLevel.ordinal > targetLevel.ordinal;
    steps.push({ icon: down ? ArrowDown : ArrowUp, text: `${ref ? `Dirígete a ${ref} y ` : ""}${down ? "baja" : "sube"} del nivel ${currentLevel.code} al nivel ${targetLevel.code}.` });
  } else if (targetLevel) steps.push({ icon: CheckCircle2, text: `Ya estás en el nivel ${targetLevel.code}.` });
  else steps.push({ icon: Compass, text: "El nivel del vehículo no fue registrado. Revisa la foto y las notas." });
  if (parking.zone) steps.push({ icon: Footprints, text: `Busca la zona ${parking.zone}.` });
  if (parking.row) steps.push({ icon: Footprints, text: `Camina hasta la fila ${parking.row}.` });
  if (parking.spot) steps.push({ icon: CheckCircle2, text: `Tu vehículo está en la plaza ${parking.spot}.` });
  return (
    <div className="space-y-4">
      <Alert><AlertDescription>Posición interior exacta no disponible. Las instrucciones se basan en lo que registraste.</AlertDescription></Alert>
      <Section title="Dónde está tu vehículo">
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <Field label="Nivel" value={parking.levelLabel} /><Field label="Zona" value={parking.zone} />
          <Field label="Fila" value={parking.row} /><Field label="Plaza" value={parking.spot} />
          <Field label="Entrada" value={parking.entrance} /><Field label="Referencia" value={parking.referencePoint} />
          <Field label="Boleto" value={parking.ticketNumber} /><Field label="Guardado" value={f.date(parking.startedAt)} />
        </dl>
        {parking.notes && <p className="mt-4 rounded-lg bg-muted p-3 text-sm">{parking.notes}</p>}
      </Section>
      <Section title="Instrucciones">
        <LevelPicker levels={levels} value={currentLevel?.id ?? null} onChange={onLevel} label="Nivel actual" />
        <ol className="mt-4 space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><s.icon className="size-4" /></span>
              <span className="pt-1">{s.text}</span>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}

function IndoorMode({ map, parking, currentLevelId, onLevel, route, setRoute, calc, calculating }: {
  map: IndoorMap; parking: ParkingSession; currentLevelId: string | null; onLevel: (id: string) => void;
  route: NavRoute | null; setRoute: (r: NavRoute | null) => void;
  calc: (d: { fromNodeId: string; toNodeId: string; accessibleOnly?: boolean }) => Promise<NavRoute>; calculating: boolean;
}) {
  const f = useFormat();
  const target = map.nodes.find((n) => n.type === "parking_spot" && n.levelId === parking.levelId && (!parking.spot || n.label.includes(parking.spot)))
    ?? map.nodes.find((n) => n.type === "parking_spot" && n.levelId === parking.levelId)
    ?? map.nodes.find((n) => n.levelId === parking.levelId);
  const [originId, setOriginId] = useState<string>("");
  const [accessible, setAccessible] = useState(false);
  const [viewLevel, setViewLevel] = useState<string>(currentLevelId ?? map.levels[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (currentLevelId) setViewLevel(currentLevelId); }, [currentLevelId]);
  const knownPoints = map.nodes.filter((n) => n.type !== "corridor" && n.type !== "parking_spot");
  const level = map.levels.find((l) => l.id === viewLevel) ?? map.levels[0];
  const routeIds = route?.legs.find((l) => l.levelId === level?.id)?.nodeIds ?? [];

  const run = async () => {
    if (!originId || !target) return;
    setError(null);
    try {
      setRoute(await calc({ fromNodeId: originId, toNodeId: target.id, accessibleOnly: accessible }));
    } catch (e) {
      setRoute(null);
      setError(e instanceof ApiError && e.status === 422 ? "No existe una ruta entre esos puntos (puede haber tramos cerrados)." : e instanceof ApiError && e.status === 404 ? "Mapa no disponible para este edificio." : errorMessage(e));
    }
  };

  if (!target) return <StateView kind="level-unconfirmed" className="surface-card" description="No pudimos ubicar la plaza del vehículo en el plano. Usa el modo básico." />;
  return (
    <div className="space-y-4">
      <Section title="Origen y ruta">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="origin">Punto conocido de origen</Label>
            <select id="origin" className="native-select" value={originId} onChange={(e) => {
              setOriginId(e.target.value);
              const n = map.nodes.find((x) => x.id === e.target.value);
              if (n) onLevel(n.levelId);
            }}>
              <option value="">Selecciona dónde estás…</option>
              {map.levels.map((l) => (
                <optgroup key={l.id} label={l.name}>
                  {knownPoints.filter((n) => n.levelId === l.id).map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-3">
            <div className="flex items-center gap-2"><Switch id="acc" checked={accessible} onCheckedChange={setAccessible} /><Label htmlFor="acc">Solo accesible</Label></div>
            <Button onClick={run} disabled={!originId || calculating}>{calculating ? <InlineSpinner /> : <RotateCw className="size-4" />} {route ? "Recalcular" : "Calcular ruta"}</Button>
          </div>
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      </Section>
      <Section title={`Plano · ${level?.name ?? ""}`} actions={<span className="text-xs text-muted-foreground">Destino: {map.levels.find((l) => l.id === target.levelId)?.code} · {target.label}</span>}>
        <div className="mb-3 flex flex-wrap gap-2">
          {map.levels.map((l) => (
            <Button key={l.id} size="sm" variant={l.id === level?.id ? "default" : "outline"} onClick={() => setViewLevel(l.id)}
              aria-pressed={l.id === level?.id}>{l.code}{l.id === currentLevelId ? " · tú" : ""}{l.id === target.levelId ? " · auto" : ""}</Button>
          ))}
        </div>
        {level && <FloorPlan level={level} nodes={map.nodes} edges={map.edges} routeNodeIds={routeIds} originId={originId} targetId={target.id}
          onNodeClick={(n) => n.type !== "corridor" && setOriginId(n.id)} />}
      </Section>
      {route && (
        <Section title={`Pasos · ${f.meters(route.totalDistanceMeters)}`}>
          <ol className="space-y-2">
            {route.steps.map((s) => (
              <li key={s.order} className="flex gap-3 text-sm">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{s.order}</span>
                <span className="flex-1">{s.instruction}</span>
                <span className="text-xs text-muted-foreground">{s.levelCode} · {f.meters(s.distanceMeters)}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}
    </div>
  );
}

function SensorMode({ onFallback, hasMap }: { onFallback: (m: NavMode) => void; hasMap: boolean }) {
  const provider = useMemo(() => getSensorProvider(), []);
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => { provider.isAvailable().then(setAvailable); }, [provider]);
  if (available === null) return <StateView kind="loading" />;
  return (
    <div className="space-y-4">
      {!available ? (
        <StateView kind="ar-unavailable" className="surface-card" title={provider.unavailableReason()}
          description="Los sensores de movimiento (pasos, rumbo, piso) solo están disponibles en la app móvil nativa. En la web no se simulan datos."
          action={<><Button variant="outline" onClick={() => onFallback("basic")}>Usar modo básico</Button>{hasMap && <Button onClick={() => onFallback("indoor")}>Usar plano interior</Button>}</>} />
      ) : null}
      <Section title="Panel de sensores">
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <Field label="Pasos" value="No disponible" /><Field label="Distancia estimada" value="No disponible" />
          <Field label="Rumbo" value="No disponible" /><Field label="Confianza" value="No disponible" />
        </dl>
      </Section>
      <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/50 text-center">
        <Glasses className="size-8 text-muted-foreground" aria-hidden />
        <p className="font-medium">AR disponible próximamente en app nativa (ARKit/ARCore)</p>
        <p className="text-xs text-muted-foreground">Marcador de posición — no se usa la cámara.</p>
      </div>
      <p className="text-xs text-muted-foreground">¿Prefieres otra opción? <Link to="/help" className="text-primary underline">Más información</Link></p>
    </div>
  );
}
