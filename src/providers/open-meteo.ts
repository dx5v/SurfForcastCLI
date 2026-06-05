import {
  CANONICAL_UNITS,
  type LatLng,
  type ProviderProvenance,
  type SurfForecast,
  type SurfForecastRequest,
  type SurfHour,
} from "../domain/surf.js";
import {
  compactSwells,
  kmhToMps,
  maybeCurrent,
  maybeWave,
  maybeWind,
  numberOrUndefined,
} from "./normalization.js";
import {
  SurfProviderError,
  type ProviderCapabilities,
  type ProviderRuntimeContext,
  type SurfDataProvider,
} from "./types.js";
import { fetchJson } from "../utils/http.js";
import {
  openMeteoTimeToUtcIso,
  resolveForecastWindow,
  takeForecastHours,
} from "../utils/time.js";

export const OPEN_METEO_PROVIDER_ID = "open-meteo";

const OPEN_METEO_MARINE_HOURLY = [
  "wave_height",
  "wave_direction",
  "wave_period",
  "swell_wave_height",
  "swell_wave_direction",
  "swell_wave_period",
  "secondary_swell_wave_height",
  "secondary_swell_wave_direction",
  "secondary_swell_wave_period",
  "tertiary_swell_wave_height",
  "tertiary_swell_wave_direction",
  "tertiary_swell_wave_period",
  "wind_wave_height",
  "wind_wave_direction",
  "wind_wave_period",
  "sea_level_height_msl",
  "sea_surface_temperature",
  "ocean_current_velocity",
  "ocean_current_direction",
] as const;

const OPEN_METEO_WEATHER_HOURLY = [
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
] as const;

type OpenMeteoHourly = {
  time?: string[];
} & Record<string, unknown>;

type OpenMeteoResponse = {
  latitude?: number;
  longitude?: number;
  timezone?: string;
  utc_offset_seconds?: number;
  hourly_units?: Record<string, string>;
  hourly?: OpenMeteoHourly;
};

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
    async fetchForecast(request, context) {
      return fetchOpenMeteoForecast(request, context);
    },
  };
}

async function fetchOpenMeteoForecast(
  request: SurfForecastRequest,
  context: ProviderRuntimeContext,
): Promise<SurfForecast> {
  const window = resolveForecastWindow({
    now: context.now(),
    start: request.start,
    end: request.end,
    hours: request.hours,
  });
  const forecastDays = Math.max(1, Math.ceil(window.hours / 24) + 1);
  const marineUrl = new URL("https://marine-api.open-meteo.com/v1/marine");
  marineUrl.search = new URLSearchParams({
    latitude: String(request.point.lat),
    longitude: String(request.point.lng),
    hourly: OPEN_METEO_MARINE_HOURLY.join(","),
    timezone: "GMT",
    forecast_days: String(forecastDays),
    cell_selection: "sea",
  }).toString();

  const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
  weatherUrl.search = new URLSearchParams({
    latitude: String(request.point.lat),
    longitude: String(request.point.lng),
    hourly: OPEN_METEO_WEATHER_HOURLY.join(","),
    wind_speed_unit: "ms",
    timezone: "GMT",
    forecast_days: String(forecastDays),
  }).toString();

  const [marine, weather] = await Promise.all([
    fetchJson<OpenMeteoResponse>({
      providerId: OPEN_METEO_PROVIDER_ID,
      label: "Open-Meteo marine",
      url: marineUrl,
      fetch: context.fetch,
      retryable: false,
    }),
    fetchJson<OpenMeteoResponse>({
      providerId: OPEN_METEO_PROVIDER_ID,
      label: "Open-Meteo weather",
      url: weatherUrl,
      fetch: context.fetch,
      retryable: false,
    }),
  ]);

  const hourly = takeForecastHours(
    normalizeOpenMeteoHours({ marine, weather }),
    window,
  );
  const resolvedPoint = pointFromResponse(marine);

  return {
    schemaVersion: "surf-forecast/v1",
    providerId: OPEN_METEO_PROVIDER_ID,
    generatedAt: context.now().toISOString(),
    point: {
      requested: request.point,
      ...(resolvedPoint ? { resolved: resolvedPoint } : {}),
      ...(request.name ? { name: request.name } : {}),
    },
    hourly,
    units: CANONICAL_UNITS,
    provenance: openMeteoProvenance({ marine, weather }),
    warnings: [],
    meta: {
      providerAttempts: [],
      attribution: ["Open-Meteo"],
    },
  };
}

function normalizeOpenMeteoHours(input: {
  marine: OpenMeteoResponse;
  weather: OpenMeteoResponse;
}): SurfHour[] {
  const marineRows = rowsByTime(input.marine.hourly);
  const weatherRows = rowsByTime(input.weather.hourly);
  const times = Array.from(new Set([...marineRows.keys(), ...weatherRows.keys()])).sort();

  return times.map((time): SurfHour => {
    const marine = marineRows.get(time);
    const weather = weatherRows.get(time);
    const swells = compactSwells([
      {
        component: "primary",
        heightM: numberOrUndefined(marine?.swell_wave_height),
        periodS: numberOrUndefined(marine?.swell_wave_period),
        directionFromDeg: numberOrUndefined(marine?.swell_wave_direction),
      },
      {
        component: "secondary",
        heightM: numberOrUndefined(marine?.secondary_swell_wave_height),
        periodS: numberOrUndefined(marine?.secondary_swell_wave_period),
        directionFromDeg: numberOrUndefined(marine?.secondary_swell_wave_direction),
      },
      {
        component: "tertiary",
        heightM: numberOrUndefined(marine?.tertiary_swell_wave_height),
        periodS: numberOrUndefined(marine?.tertiary_swell_wave_period),
        directionFromDeg: numberOrUndefined(marine?.tertiary_swell_wave_direction),
      },
    ]);
    const wave = maybeWave({
      heightM: numberOrUndefined(marine?.wave_height),
      periodS: numberOrUndefined(marine?.wave_period),
      directionFromDeg: numberOrUndefined(marine?.wave_direction),
    });
    const windWave = maybeWave({
      heightM: numberOrUndefined(marine?.wind_wave_height),
      periodS: numberOrUndefined(marine?.wind_wave_period),
      directionFromDeg: numberOrUndefined(marine?.wind_wave_direction),
    });
    const wind = maybeWind({
      speedMps: numberOrUndefined(weather?.wind_speed_10m),
      gustMps: numberOrUndefined(weather?.wind_gusts_10m),
      directionFromDeg: numberOrUndefined(weather?.wind_direction_10m),
    });
    const current = maybeCurrent({
      speedMps: kmhToMps(numberOrUndefined(marine?.ocean_current_velocity)),
      directionToDeg: numberOrUndefined(marine?.ocean_current_direction),
    });
    const seaLevel = numberOrUndefined(marine?.sea_level_height_msl);
    const waterTempC = numberOrUndefined(marine?.sea_surface_temperature);

    return {
      time,
      ...(wave ? { wave } : {}),
      ...(windWave ? { windWave } : {}),
      ...(swells ? { swells } : {}),
      ...(wind ? { wind } : {}),
      ...(seaLevel !== undefined ? { tide: { heightM: seaLevel, datum: "MSL" } } : {}),
      ...(current ? { current } : {}),
      ...(waterTempC !== undefined ? { waterTempC } : {}),
      sources: {
        wave: "open-meteo-marine",
        swell: "open-meteo-marine",
        windWave: "open-meteo-marine",
        tide: "open-meteo-marine",
        current: "open-meteo-marine",
        waterTemperature: "open-meteo-marine",
        wind: "open-meteo-forecast",
      },
    };
  });
}

function rowsByTime(hourly: OpenMeteoHourly | undefined): Map<string, Record<string, unknown>> {
  const rows = new Map<string, Record<string, unknown>>();

  if (!hourly?.time) {
    return rows;
  }

  hourly.time.forEach((nativeTime, index) => {
    const time = openMeteoTimeToUtcIso(nativeTime);
    const row: Record<string, unknown> = {};

    for (const [key, values] of Object.entries(hourly)) {
      if (key !== "time" && Array.isArray(values)) {
        row[key] = values[index];
      }
    }

    rows.set(time, row);
  });

  return rows;
}

function pointFromResponse(response: OpenMeteoResponse): LatLng | undefined {
  const lat = numberOrUndefined(response.latitude);
  const lng = numberOrUndefined(response.longitude);

  if (lat === undefined || lng === undefined) {
    return undefined;
  }

  return { lat, lng };
}

function openMeteoProvenance(input: {
  marine: OpenMeteoResponse;
  weather: OpenMeteoResponse;
}): ProviderProvenance[] {
  const marinePoint = pointFromResponse(input.marine);
  const weatherPoint = pointFromResponse(input.weather);

  return [
    {
      providerId: OPEN_METEO_PROVIDER_ID,
      endpoint: "marine-api/v1/marine",
      fields: [...OPEN_METEO_MARINE_HOURLY],
      ...(marinePoint ? { resolvedPoint: marinePoint } : {}),
    },
    {
      providerId: OPEN_METEO_PROVIDER_ID,
      endpoint: "api/v1/forecast",
      fields: [...OPEN_METEO_WEATHER_HOURLY],
      ...(weatherPoint ? { resolvedPoint: weatherPoint } : {}),
    },
  ];
}
