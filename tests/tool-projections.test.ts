import assert from "node:assert/strict";
import test from "node:test";
import { CANONICAL_UNITS, type SurfForecast } from "../src/index.js";
import {
  projectOceanForecast,
  projectTideForecast,
  projectWaveForecast,
  projectWindForecast,
} from "../src/tools/projections.js";

test("wave projection can hide wind-wave and swell components", () => {
  const projection = projectWaveForecast(fakeForecast(), {
    includeWindWave: false,
    includeSwellComponents: false,
  });

  assert.equal(projection.hourly[0]?.wave?.heightM, 2);
  assert.equal(projection.hourly[0]?.windWave, undefined);
  assert.equal(projection.hourly[0]?.swells, undefined);
  assert.deepEqual(projection.units, {
    waveHeight: "m",
    wavePeriod: "s",
    direction: "deg",
  });
});

test("wind projection can hide gusts", () => {
  const projection = projectWindForecast(fakeForecast(), {
    includeGusts: false,
  });

  assert.equal(projection.hourly[0]?.wind?.speedMps, 3);
  assert.equal(projection.hourly[0]?.wind?.gustMps, undefined);
});

test("tide projection supports hourly and extreme modes", () => {
  const forecast = fakeForecast();

  assert.equal(projectTideForecast(forecast, "hourly").extremes, undefined);
  assert.equal(projectTideForecast(forecast, "extremes").hourly, undefined);
  assert.equal(projectTideForecast(forecast, "both").extremes?.[0]?.type, "high");
});

test("ocean projection includes currents and water temperature", () => {
  const projection = projectOceanForecast(fakeForecast());

  assert.equal(projection.hourly[0]?.current?.speedMps, 0.2);
  assert.equal(projection.hourly[0]?.waterTempC, 14.5);
});

function fakeForecast(): SurfForecast {
  return {
    schemaVersion: "surf-forecast/v1",
    providerId: "stormglass",
    generatedAt: "2026-06-05T01:00:00Z",
    point: {
      requested: { lat: 1, lng: 2 },
      name: "Test Spot",
    },
    hourly: [
      {
        time: "2026-06-05T01:00:00Z",
        wave: {
          heightM: 2,
          periodS: 10,
          directionFromDeg: 290,
        },
        windWave: {
          heightM: 0.4,
          periodS: 3,
          directionFromDeg: 300,
        },
        swells: [
          {
            component: "primary",
            heightM: 1.8,
            periodS: 12,
            directionFromDeg: 285,
          },
        ],
        wind: {
          speedMps: 3,
          gustMps: 6,
          directionFromDeg: 270,
        },
        tide: {
          heightM: 0.5,
          datum: "MSL",
        },
        current: {
          speedMps: 0.2,
          directionToDeg: 180,
        },
        waterTempC: 14.5,
        sources: {
          wave: "test",
        },
      },
    ],
    tides: [
      {
        time: "2026-06-05T01:30:00Z",
        type: "high",
        heightM: 0.7,
        datum: "MLLW",
      },
    ],
    units: CANONICAL_UNITS,
    provenance: [],
    warnings: [],
    meta: {
      providerAttempts: [
        {
          providerId: "stormglass",
          status: "succeeded",
        },
      ],
    },
  };
}

