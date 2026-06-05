import {
  CANONICAL_UNITS,
  type LatLng,
  type ProviderProvenance,
  type SurfDataField,
  type SurfForecast,
  type SurfForecastRequest,
  type SurfHour,
  type TideDatum,
  type TideEvent,
  type TideStation,
} from "../domain/surf.js";
import {
  compactStation,
  compactSwells,
  compactTides,
  maybeCurrent,
  maybeWave,
  maybeWind,
  numberOrUndefined,
  stringOrUndefined,
} from "./normalization.js";
import {
  SurfProviderError,
  type ProviderCapabilities,
  type ProviderRuntimeContext,
  type SurfDataProvider,
} from "./types.js";
import { fetchJson } from "../utils/http.js";
import { resolveForecastWindow, takeForecastHours, toUtcIso } from "../utils/time.js";

export const STORMGLASS_PROVIDER_ID = "stormglass";
export const STORMGLASS_API_KEY_ENV = "STORMGLASS_API_KEY";
export const STORMGLASS_DEFAULT_SOURCE = "sg";
export const STORMGLASS_DEFAULT_DATUM = "MLLW";

const STORMGLASS_WEATHER_PARAMS = [
  "waveHeight",
  "waveDirection",
  "wavePeriod",
  "swellHeight",
  "swellDirection",
  "swellPeriod",
  "secondarySwellHeight",
  "secondarySwellDirection",
  "secondarySwellPeriod",
  "windWaveHeight",
  "windWaveDirection",
  "windWavePeriod",
  "windSpeed",
  "windDirection",
  "gust",
  "waterTemperature",
  "currentSpeed",
  "currentDirection",
] as const;

type StormglassSourceValue = Record<string, number | string | null | undefined>;

type StormglassWeatherHour = {
  time?: string;
} & Partial<Record<(typeof STORMGLASS_WEATHER_PARAMS)[number], StormglassSourceValue>>;

type StormglassWeatherResponse = {
  hours?: StormglassWeatherHour[];
  meta?: {
    lat?: number;
    lng?: number;
    source?: string[];
    params?: string[];
    requestCount?: number;
    dailyQuota?: number;
  };
};

type StormglassTideExtreme = {
  height?: number;
  time?: string;
  type?: string;
};

type StormglassTideResponse = {
  data?: StormglassTideExtreme[];
  meta?: {
    datum?: string;
    station?: {
      distance?: number;
      lat?: number;
      lng?: number;
      name?: string;
      source?: string;
    };
  };
};

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
    async fetchForecast(request, context) {
      return fetchStormglassForecast(request, context);
    },
  };
}

async function fetchStormglassForecast(
  request: SurfForecastRequest,
  context: ProviderRuntimeContext,
): Promise<SurfForecast> {
  const apiKey = context.env[STORMGLASS_API_KEY_ENV];

  if (!apiKey) {
    throw new SurfProviderError({
      providerId: STORMGLASS_PROVIDER_ID,
      code: "not_configured",
      retryable: true,
      message: `${STORMGLASS_API_KEY_ENV} is not set.`,
    });
  }

  const window = resolveForecastWindow({
    now: context.now(),
    start: request.start,
    end: request.end,
    hours: request.hours,
  });
  const source = providerOptionString(
    request,
    "source",
    STORMGLASS_DEFAULT_SOURCE,
  );
  const datum = providerOptionString(
    request,
    "datum",
    STORMGLASS_DEFAULT_DATUM,
  ) as TideDatum;
  const includeTides = wantsField(request, "tide");
  const weatherUrl = new URL("https://api.stormglass.io/v2/weather/point");
  weatherUrl.search = new URLSearchParams({
    lat: String(request.point.lat),
    lng: String(request.point.lng),
    params: STORMGLASS_WEATHER_PARAMS.join(","),
    source,
    start: toUtcIso(window.start),
    end: toUtcIso(window.end),
  }).toString();

  const weather = await fetchJson<StormglassWeatherResponse>({
    providerId: STORMGLASS_PROVIDER_ID,
    label: "Stormglass weather",
    url: weatherUrl,
    fetch: context.fetch,
    options: {
      headers: { Authorization: apiKey },
    },
    retryable: true,
  });

  const tides = includeTides
    ? await fetchStormglassTides({
        apiKey,
        datum,
        request,
        context,
        start: window.start,
        end: window.end,
      })
    : undefined;

  const station = tides ? tideStationFromMeta(tides.meta) : undefined;
  const hourly = takeForecastHours(normalizeWeatherHours(weather.hours ?? [], source), window);
  const tideEvents = tides
    ? normalizeTideEvents(tides.data ?? [], datum, station)
    : undefined;
  const compactedTides = compactTides(tideEvents ?? []);
  const provenance = stormglassProvenance({
    request,
    weather,
    source,
    includeTides,
  });
  const resolvedPoint = pointFromMeta(weather.meta);

  return {
    schemaVersion: "surf-forecast/v1",
    providerId: STORMGLASS_PROVIDER_ID,
    generatedAt: context.now().toISOString(),
    point: {
      requested: request.point,
      ...(resolvedPoint ? { resolved: resolvedPoint } : {}),
      ...(request.name ? { name: request.name } : {}),
    },
    hourly,
    ...(compactedTides ? { tides: compactedTides } : {}),
    units: CANONICAL_UNITS,
    provenance,
    warnings: [],
    meta: {
      providerAttempts: [],
      attribution: ["Stormglass"],
      nativeSources: weather.meta?.source ?? [source],
    },
  };
}

async function fetchStormglassTides(input: {
  apiKey: string;
  datum: TideDatum;
  request: SurfForecastRequest;
  context: ProviderRuntimeContext;
  start: Date;
  end: Date;
}): Promise<StormglassTideResponse> {
  const tidesUrl = new URL("https://api.stormglass.io/v2/tide/extremes/point");
  tidesUrl.search = new URLSearchParams({
    lat: String(input.request.point.lat),
    lng: String(input.request.point.lng),
    datum: input.datum,
    start: toUtcIso(input.start),
    end: toUtcIso(input.end),
  }).toString();

  return fetchJson<StormglassTideResponse>({
    providerId: STORMGLASS_PROVIDER_ID,
    label: "Stormglass tide extremes",
    url: tidesUrl,
    fetch: input.context.fetch,
    options: {
      headers: { Authorization: input.apiKey },
    },
    retryable: true,
  });
}

function normalizeWeatherHours(
  hours: StormglassWeatherHour[],
  source: string,
): SurfHour[] {
  return hours.flatMap((hour): SurfHour[] => {
    if (!hour.time) {
      return [];
    }

    const wave = maybeWave({
      heightM: sourceValue(hour.waveHeight, source),
      periodS: sourceValue(hour.wavePeriod, source),
      directionFromDeg: sourceValue(hour.waveDirection, source),
    });
    const windWave = maybeWave({
      heightM: sourceValue(hour.windWaveHeight, source),
      periodS: sourceValue(hour.windWavePeriod, source),
      directionFromDeg: sourceValue(hour.windWaveDirection, source),
    });
    const swells = compactSwells([
      {
        component: "primary",
        heightM: sourceValue(hour.swellHeight, source),
        periodS: sourceValue(hour.swellPeriod, source),
        directionFromDeg: sourceValue(hour.swellDirection, source),
      },
      {
        component: "secondary",
        heightM: sourceValue(hour.secondarySwellHeight, source),
        periodS: sourceValue(hour.secondarySwellPeriod, source),
        directionFromDeg: sourceValue(hour.secondarySwellDirection, source),
      },
    ]);
    const wind = maybeWind({
      speedMps: sourceValue(hour.windSpeed, source),
      gustMps: sourceValue(hour.gust, source),
      directionFromDeg: sourceValue(hour.windDirection, source),
    });
    const current = maybeCurrent({
      speedMps: sourceValue(hour.currentSpeed, source),
      directionToDeg: sourceValue(hour.currentDirection, source),
    });
    const waterTempC = sourceValue(hour.waterTemperature, source);
    const row: SurfHour = {
      time: hour.time,
      ...(wave ? { wave } : {}),
      ...(windWave ? { windWave } : {}),
      ...(swells ? { swells } : {}),
      ...(wind ? { wind } : {}),
      ...(current ? { current } : {}),
      ...(waterTempC !== undefined ? { waterTempC } : {}),
      sources: Object.fromEntries(
        STORMGLASS_WEATHER_PARAMS.map((param) => [param, source]),
      ),
    };

    return [row];
  });
}

function normalizeTideEvents(
  data: StormglassTideExtreme[],
  datum: TideDatum,
  station: TideStation | undefined,
): TideEvent[] {
  return data.flatMap((event): TideEvent[] => {
    const heightM = numberOrUndefined(event.height);
    const type = event.type === "high" || event.type === "low" ? event.type : undefined;

    if (!event.time || !type || heightM === undefined) {
      return [];
    }

    return [
      {
        time: event.time,
        type,
        heightM,
        datum,
        ...(station ? { station } : {}),
      },
    ];
  });
}

function sourceValue(
  value: StormglassSourceValue | undefined,
  preferredSource: string,
): number | undefined {
  if (!value) {
    return undefined;
  }

  const preferred = numericValue(value[preferredSource]);

  if (preferred !== undefined) {
    return preferred;
  }

  for (const nativeValue of Object.values(value)) {
    const parsed = numericValue(nativeValue);

    if (parsed !== undefined) {
      return parsed;
    }
  }

  return undefined;
}

function numericValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function tideStationFromMeta(
  meta: StormglassTideResponse["meta"],
): TideStation | undefined {
  const station = meta?.station;

  if (!station) {
    return undefined;
  }

  const lat = numberOrUndefined(station.lat);
  const lng = numberOrUndefined(station.lng);
  const point = lat !== undefined && lng !== undefined ? { lat, lng } : undefined;
  const name = stringOrUndefined(station.name);
  const distanceKm = numberOrUndefined(station.distance);
  const source = stringOrUndefined(station.source);

  return compactStation({
    ...(name ? { name } : {}),
    ...(point ? { point } : {}),
    ...(distanceKm !== undefined ? { distanceKm } : {}),
    ...(source ? { source } : {}),
  });
}

function pointFromMeta(meta: StormglassWeatherResponse["meta"]): LatLng | undefined {
  const lat = numberOrUndefined(meta?.lat);
  const lng = numberOrUndefined(meta?.lng);

  if (lat === undefined || lng === undefined) {
    return undefined;
  }

  return { lat, lng };
}

function stormglassProvenance(input: {
  request: SurfForecastRequest;
  weather: StormglassWeatherResponse;
  source: string;
  includeTides: boolean;
}): ProviderProvenance[] {
  return [
    {
      providerId: STORMGLASS_PROVIDER_ID,
      endpoint: "weather/point",
      fields: [...STORMGLASS_WEATHER_PARAMS],
      nativeSource: input.source,
      resolvedPoint: pointFromMeta(input.weather.meta) ?? input.request.point,
    },
    ...(input.includeTides
      ? [
          {
            providerId: STORMGLASS_PROVIDER_ID,
            endpoint: "tide/extremes/point",
            fields: ["height", "time", "type"],
            nativeSource: input.source,
          } satisfies ProviderProvenance,
        ]
      : []),
  ];
}

function providerOptionString(
  request: SurfForecastRequest,
  key: string,
  fallback: string,
): string {
  const value = request.providerOptions?.[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function wantsField(request: SurfForecastRequest, field: SurfDataField): boolean {
  return !request.fields?.length || request.fields.includes(field);
}
