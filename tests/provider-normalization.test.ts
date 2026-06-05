import assert from "node:assert/strict";
import test from "node:test";
import { createOpenMeteoProvider } from "../src/providers/open-meteo.js";
import { createStormglassProvider } from "../src/providers/stormglass.js";

test("Stormglass provider normalizes source-wrapped weather and tide extremes", async () => {
  const provider = createStormglassProvider();
  const fetch = mockJsonFetch((url) => {
    if (url.pathname.endsWith("/weather/point")) {
      return {
        hours: [
          {
            time: "2026-06-05T01:00:00+00:00",
            waveHeight: { sg: 2.65 },
            waveDirection: { sg: 291.93 },
            wavePeriod: { sg: 5.99 },
            swellHeight: { sg: 2.41 },
            swellDirection: { sg: 260.5 },
            swellPeriod: { sg: 6.84 },
            secondarySwellHeight: { sg: 0.34 },
            secondarySwellDirection: { sg: 208.86 },
            secondarySwellPeriod: { sg: 17.9 },
            windSpeed: { sg: 1.51 },
            windDirection: { sg: 207.44 },
            gust: { sg: 4.43 },
            currentSpeed: { sg: 0.16 },
            currentDirection: { sg: 350.13 },
            waterTemperature: { sg: 16.51 },
          },
        ],
        meta: {
          lat: 36.951,
          lng: -122.026,
          source: ["sg"],
        },
      };
    }

    return {
      data: [
        {
          height: 0.265,
          time: "2026-06-05T01:41:00+00:00",
          type: "high",
        },
      ],
      meta: {
        datum: "MLLW",
        station: {
          distance: 21,
          lat: 36.868,
          lng: -121.8175,
          name: "station",
          source: "ticon4",
        },
      },
    };
  });

  const forecast = await provider.fetchForecast(
    {
      point: { lat: 36.951, lng: -122.026 },
      start: "2026-06-05T01:00:00Z",
      hours: 1,
    },
    {
      env: { STORMGLASS_API_KEY: "test-key" },
      fetch,
      now: () => new Date("2026-06-05T01:30:00Z"),
    },
  );

  assert.equal(forecast.providerId, "stormglass");
  assert.equal(forecast.hourly.length, 1);
  assert.equal(forecast.hourly[0]?.wave?.heightM, 2.65);
  assert.equal(forecast.hourly[0]?.swells?.[0]?.heightM, 2.41);
  assert.equal(forecast.hourly[0]?.wind?.speedMps, 1.51);
  assert.equal(forecast.tides?.[0]?.type, "high");
  assert.equal(forecast.tides?.[0]?.station?.distanceKm, 21);
});

test("Open-Meteo provider joins marine and weather rows by UTC time", async () => {
  const provider = createOpenMeteoProvider();
  const fetch = mockJsonFetch((url) => {
    if (url.hostname === "marine-api.open-meteo.com") {
      return {
        latitude: 36.958336,
        longitude: -122.04166,
        hourly: {
          time: ["2026-06-05T01:00"],
          wave_height: [2.14],
          wave_direction: [286],
          wave_period: [9.3],
          swell_wave_height: [1.66],
          swell_wave_direction: [292],
          swell_wave_period: [7.45],
          sea_level_height_msl: [0.25],
          sea_surface_temperature: [14.9],
          ocean_current_velocity: [0.4],
          ocean_current_direction: [180],
        },
      };
    }

    return {
      latitude: 36.95258,
      longitude: -122.02655,
      hourly: {
        time: ["2026-06-05T01:00"],
        wind_speed_10m: [2.16],
        wind_direction_10m: [283],
        wind_gusts_10m: [2.2],
      },
    };
  });

  const forecast = await provider.fetchForecast(
    {
      point: { lat: 36.951, lng: -122.026 },
      start: "2026-06-05T01:00:00Z",
      hours: 1,
    },
    {
      env: {},
      fetch,
      now: () => new Date("2026-06-05T01:30:00Z"),
    },
  );

  assert.equal(forecast.providerId, "open-meteo");
  assert.equal(forecast.hourly.length, 1);
  assert.equal(forecast.hourly[0]?.time, "2026-06-05T01:00:00Z");
  assert.equal(forecast.hourly[0]?.wave?.heightM, 2.14);
  assert.equal(forecast.hourly[0]?.wind?.speedMps, 2.16);
  assert.equal(forecast.hourly[0]?.current?.speedMps, 0.4 / 3.6);
  assert.equal(forecast.provenance.length, 2);
});

function mockJsonFetch(resolver: (url: URL) => unknown): typeof globalThis.fetch {
  return async (input) => {
    const url =
      input instanceof URL
        ? input
        : new URL(typeof input === "string" ? input : input.url);
    return new Response(JSON.stringify(resolver(url)), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}
