const raw = import.meta.env;

export const env = {
  apiBaseUrl: String(raw["VITE_API_BASE_URL"] ?? "http://localhost:3000").replace(/\/$/, ""),
  mapProvider: (raw["VITE_MAP_PROVIDER"] === "none" ? "none" : "leaflet") as "leaflet" | "none",
  mapApiKey: String(raw["VITE_MAP_API_KEY"] ?? ""),
  demoMode: raw["VITE_ENABLE_DEMO_MODE"] === "true",
  wsUrl: String(raw["VITE_WS_URL"] ?? "ws://localhost:3000").replace(/\/$/, ""),
};

export const API_URL = `${env.apiBaseUrl}/api/v1`;
