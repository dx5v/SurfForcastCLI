import assert from "node:assert/strict";
import test from "node:test";
import {
  CANONICAL_UNITS,
  ProviderRegistry,
  SurfForecastService,
  type SurfDataProvider,
  type SurfForecast,
} from "../src/index.js";

test("default provider plan is Stormglass then Open-Meteo", () => {
  const service = new SurfForecastService();

  assert.deepEqual(service.getProviderPlan({ point: { lat: 1, lng: 2 } }), [
    "stormglass",
    "open-meteo",
  ]);
});

test("service skips unconfigured provider and returns fallback forecast with warning", async () => {
  const primary = fakeProvider({
    id: "stormglass",
    configured: false,
  });
  const fallback = fakeProvider({
    id: "open-meteo",
    configured: true,
    forecast: fakeForecast("open-meteo"),
  });
  const service = new SurfForecastService({
    registry: new ProviderRegistry([primary, fallback]),
    context: {
      env: {},
      fetch: globalThis.fetch,
      now: () => new Date("2026-06-05T01:00:00Z"),
    },
  });

  const forecast = await service.getForecast({ point: { lat: 1, lng: 2 } });

  assert.equal(forecast.providerId, "open-meteo");
  assert.deepEqual(
    forecast.meta.providerAttempts.map((attempt) => [
      attempt.providerId,
      attempt.status,
    ]),
    [
      ["stormglass", "skipped"],
      ["open-meteo", "succeeded"],
    ],
  );
  assert.equal(forecast.warnings[0]?.code, "not_configured");
});

function fakeProvider(input: {
  id: string;
  configured: boolean;
  forecast?: SurfForecast;
}): SurfDataProvider {
  return {
    id: input.id,
    displayName: input.id,
    capabilities: {
      forecast: true,
      fields: ["wave"],
      swellComponents: [],
      tides: "none",
      currents: false,
      waterTemperature: false,
      nativeSources: false,
      requiresApiKey: !input.configured,
    },
    getConfigStatus() {
      return input.configured
        ? { configured: true }
        : {
            configured: false,
            reason: `${input.id} is not configured.`,
          };
    },
    async fetchForecast() {
      if (!input.forecast) {
        throw new Error("No fake forecast configured.");
      }

      return input.forecast;
    },
  };
}

function fakeForecast(providerId: string): SurfForecast {
  return {
    schemaVersion: "surf-forecast/v1",
    providerId,
    generatedAt: "2026-06-05T01:00:00Z",
    point: {
      requested: { lat: 1, lng: 2 },
    },
    hourly: [
      {
        time: "2026-06-05T01:00:00Z",
        wave: { heightM: 1 },
      },
    ],
    units: CANONICAL_UNITS,
    provenance: [],
    warnings: [],
    meta: {
      providerAttempts: [],
    },
  };
}

