#!/usr/bin/env node

type CliArgs = Record<string, string>;

type Point = {
  name: string;
  lat: number;
  lng: number;
};

type HourlySeries = {
  time?: string[];
} & Record<string, unknown>;

type FetchFailure = {
  error: true;
  label: string;
  status: number;
  statusText: string;
  body: unknown;
};

type OpenMeteoResponse =
  | FetchFailure
  | {
      latitude?: number;
      longitude?: number;
      timezone?: string;
      utc_offset_seconds?: number;
      hourly_units?: Record<string, string>;
      hourly?: HourlySeries;
    };

type StormglassWeatherResponse =
  | FetchFailure
  | {
      meta?: unknown;
      hours?: unknown[];
    };

type StormglassTidesResponse =
  | FetchFailure
  | {
      meta?: unknown;
      data?: unknown[];
    };

type ProbeOutput = {
  generatedAt: string;
  point: Point;
  request: {
    provider: string;
    timezone: string;
    forecastHours: number;
    sampleSize: number;
    stormglassSource: string;
    stormglassDatum: string;
  };
  openMeteo?: Awaited<ReturnType<typeof probeOpenMeteo>>;
  stormglass?: Awaited<ReturnType<typeof probeStormglass>>;
};

const DEFAULT_POINT: Point = {
  name: "Steamer Lane, Santa Cruz",
  lat: 36.951,
  lng: -122.026,
};

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

const args = parseArgs(process.argv.slice(2));
const lat = numberArg(args, "lat", DEFAULT_POINT.lat);
const lng = numberArg(args, "lng", DEFAULT_POINT.lng);
const name = stringArg(args, "name", DEFAULT_POINT.name);
const provider = stringArg(args, "provider", "all");
const timezone = stringArg(args, "timezone", "America/Los_Angeles");
const forecastHours = numberArg(args, "hours", 48);
const sampleSize = numberArg(args, "sample", 5);
const stormglassSource = stringArg(args, "stormglass-source", "sg");
const stormglassDatum = stringArg(args, "stormglass-datum", "MLLW");

const start = new Date();
const end = new Date(start.getTime() + forecastHours * 60 * 60 * 1000);
const forecastDays = Math.max(1, Math.ceil(forecastHours / 24));

const output: ProbeOutput = {
  generatedAt: new Date().toISOString(),
  point: { name, lat, lng },
  request: {
    provider,
    timezone,
    forecastHours,
    sampleSize,
    stormglassSource,
    stormglassDatum,
  },
};

if (provider === "all" || provider === "open-meteo") {
  output.openMeteo = await probeOpenMeteo();
}

if (provider === "all" || provider === "stormglass") {
  output.stormglass = await probeStormglass();
}

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

async function probeOpenMeteo() {
  const marineUrl = new URL("https://marine-api.open-meteo.com/v1/marine");
  marineUrl.search = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    hourly: OPEN_METEO_MARINE_HOURLY.join(","),
    timezone,
    forecast_days: String(forecastDays),
    cell_selection: "sea",
  }).toString();

  const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
  weatherUrl.search = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    hourly: OPEN_METEO_WEATHER_HOURLY.join(","),
    wind_speed_unit: "ms",
    timezone,
    forecast_days: String(forecastDays),
  }).toString();

  const [marine, weather] = await Promise.all([
    fetchJson<OpenMeteoResponse>("open-meteo marine", marineUrl),
    fetchJson<OpenMeteoResponse>("open-meteo weather", weatherUrl),
  ]);

  return {
    marine: summarizeOpenMeteoResponse(marine),
    weather: summarizeOpenMeteoResponse(weather),
  };
}

async function probeStormglass() {
  const apiKey = process.env.STORMGLASS_API_KEY;

  if (!apiKey) {
    return {
      skipped: true,
      reason: "STORMGLASS_API_KEY is not set in this shell.",
      example:
        "STORMGLASS_API_KEY=... npm run probe:providers -- --provider stormglass",
    };
  }

  const weatherUrl = new URL("https://api.stormglass.io/v2/weather/point");
  weatherUrl.search = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    params: STORMGLASS_WEATHER_PARAMS.join(","),
    source: stormglassSource,
    start: start.toISOString(),
    end: end.toISOString(),
  }).toString();

  const tidesUrl = new URL("https://api.stormglass.io/v2/tide/extremes/point");
  tidesUrl.search = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    datum: stormglassDatum,
    start: start.toISOString(),
    end: end.toISOString(),
  }).toString();

  const headers = { Authorization: apiKey };
  const [weather, tides] = await Promise.all([
    fetchJson<StormglassWeatherResponse>("stormglass weather", weatherUrl, {
      headers,
    }),
    fetchJson<StormglassTidesResponse>("stormglass tides", tidesUrl, {
      headers,
    }),
  ]);

  return {
    weather: summarizeStormglassWeather(weather),
    tides: summarizeStormglassTides(tides),
  };
}

async function fetchJson<T>(
  label: string,
  url: URL,
  options: RequestInit = {},
): Promise<T | FetchFailure> {
  const response = await fetch(url, options);
  const text = await response.text();
  const body = parseJson(text);

  if (!response.ok) {
    return {
      error: true,
      label,
      status: response.status,
      statusText: response.statusText,
      body,
    };
  }

  return body as T;
}

function summarizeOpenMeteoResponse(response: OpenMeteoResponse) {
  if (isFetchFailure(response)) {
    return response;
  }

  return {
    resolvedPoint: {
      lat: response.latitude,
      lng: response.longitude,
    },
    timezone: response.timezone,
    utcOffsetSeconds: response.utc_offset_seconds,
    units: response.hourly_units,
    sample: sampleHourlyTable(response.hourly),
  };
}

function summarizeStormglassWeather(response: StormglassWeatherResponse) {
  if (isFetchFailure(response)) {
    return response;
  }

  return {
    meta: response.meta,
    sample: response.hours?.slice(0, sampleSize) ?? [],
  };
}

function summarizeStormglassTides(response: StormglassTidesResponse) {
  if (isFetchFailure(response)) {
    return response;
  }

  return {
    meta: response.meta,
    sample: response.data?.slice(0, sampleSize) ?? [],
  };
}

function sampleHourlyTable(hourly?: HourlySeries) {
  if (!hourly?.time) {
    return [];
  }

  return hourly.time.slice(0, sampleSize).map((time, index) => {
    const row: Record<string, unknown> = { time };

    for (const [key, values] of Object.entries(hourly)) {
      if (key !== "time") {
        row[key] = Array.isArray(values) ? values[index] : values;
      }
    }

    return row;
  });
}

function parseArgs(argv: string[]): CliArgs {
  const parsed: CliArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg?.startsWith("--")) {
      continue;
    }

    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    const nextValue = argv[index + 1];

    if (!rawKey) {
      continue;
    }

    if (inlineValue !== undefined) {
      parsed[rawKey] = inlineValue;
    } else if (nextValue && !nextValue.startsWith("--")) {
      parsed[rawKey] = nextValue;
      index += 1;
    } else {
      parsed[rawKey] = "true";
    }
  }

  return parsed;
}

function stringArg(args: CliArgs, key: string, fallback: string): string {
  return args[key] ?? fallback;
}

function numberArg(args: CliArgs, key: string, fallback: number): number {
  const raw = args[key];

  if (raw === undefined) {
    return fallback;
  }

  const value = Number(raw);

  if (!Number.isFinite(value)) {
    throw new Error(`--${key} must be a number.`);
  }

  return value;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isFetchFailure(value: unknown): value is FetchFailure {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    (value as { error?: unknown }).error === true
  );
}
