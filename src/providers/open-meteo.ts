import type { SurfForecastRequest } from "../domain/surf.js";
import {
  SurfProviderError,
  type ProviderCapabilities,
  type ProviderRuntimeContext,
  type SurfDataProvider,
} from "./types.js";

export const OPEN_METEO_PROVIDER_ID = "open-meteo";

export const openMeteoCapabilities: ProviderCapabilities = {
  forecast: true,
  fields: [
    "wave",
    "swell",
    "windWave",
    "wind",
    "tide",
    "current",
    "waterTemperature",
  ],
  swellComponents: ["primary", "secondary", "tertiary"],
  tides: "sea-level",
  currents: true,
  waterTemperature: true,
  nativeSources: false,
  requiresApiKey: false,
  notes: [
    "Fallback provider.",
    "Marine and weather data come from separate Open-Meteo APIs and must be joined by time.",
    "Ocean current velocity is returned in km/h by the marine API and must be normalized to m/s.",
  ],
};

export function createOpenMeteoProvider(): SurfDataProvider {
  return {
    id: OPEN_METEO_PROVIDER_ID,
    displayName: "Open-Meteo",
    capabilities: openMeteoCapabilities,
    getConfigStatus() {
      return { configured: true };
    },
    async fetchForecast(
      _request: SurfForecastRequest,
      _context: ProviderRuntimeContext,
    ) {
      throw new SurfProviderError({
        providerId: OPEN_METEO_PROVIDER_ID,
        code: "not_implemented",
        retryable: false,
        message:
          "Open-Meteo provider adapter is not implemented yet. Use scripts/probe-providers.ts for raw provider exploration.",
      });
    },
  };
}

