import type { SensorEstimate } from "@/types/api";

/** Interfaz para la capa nativa (iOS/Android) que entregará estimaciones de sensores. */
export interface SensorProvider {
  readonly id: string;
  isAvailable(): Promise<boolean>;
  unavailableReason(): string;
  start(onEstimate: (e: SensorEstimate) => void): Promise<void>;
  stop(): void;
}

/** Navegador web: no se leen sensores ni se simulan datos. */
export class UnsupportedSensorProvider implements SensorProvider {
  readonly id = "web-unsupported";
  async isAvailable() {
    return false;
  }
  unavailableReason() {
    return "Requiere la app móvil nativa";
  }
  async start() {
    throw new Error(this.unavailableReason());
  }
  stop() {}
}

export function getSensorProvider(): SensorProvider {
  return new UnsupportedSensorProvider();
}
