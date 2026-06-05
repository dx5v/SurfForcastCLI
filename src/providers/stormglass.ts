import type { SurfForecastRequest } from "../domain/surf.js";
import {
  SurfProviderError,
  type ProviderCapabilities,
  type ProviderRuntimeContext,
  type SurfDataProvider,
} from "./types.js";

export const STORMGLASS_PROVIDER_ID = "stormglass";
export const STORMGLASS_API_KEY_ENV = "STORMGLASS_API_KEY";

export const stormglassCapabilities: ProviderCapabilities = {
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
  swellComponents: ["primary", "secondary"],
  tides: "extremes",
  currents: true,
  waterTemperature: true,
  nativeSources: true,
  requiresApiKey: true,
  notes: [
    "Default source should be sg unless a caller passes providerOptions.source.",
    "Weather readings are source-wrapped, e.g. waveHeight.sg.",
    "Tide extremes come from a separate endpoint and include station metadata.",
  ],
};

export function createStormglassProvider(): SurfDataProvider {
  return {
    id: STORMGLASS_PROVIDER_ID,
    displayName: "Stormglass",
    capabilities: stormglassCapabilities,
    getConfigStatus(env) {
      if (env[STORMGLASS_API_KEY_ENV]) {
        return { configured: true };
      }

      return {
        configured: false,
        reason: `${STORMGLASS_API_KEY_ENV} is not set.`,
        missingEnvVars: [STORMGLASS_API_KEY_ENV],
      };
    },
    async fetchForecast(
      _request: SurfForecastRequest,
      _context: ProviderRuntimeContext,
    ) {
      throw new SurfProviderError({
        providerId: STORMGLASS_PROVIDER_ID,
        code: "not_implemented",
        retryable: true,
        message:
          "Stormglass provider adapter is not implemented yet. Use scripts/probe-providers.ts for raw provider exploration.",
      });
    },
  };
}

