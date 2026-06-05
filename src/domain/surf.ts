export type IsoDateTime = string;

export type KnownProviderId = "stormglass" | "open-meteo";
export type ProviderId = KnownProviderId | (string & {});

export type LatLng = {
  lat: number;
  lng: number;
};

export type SurfDataField =
  | "wave"
  | "swell"
  | "windWave"
  | "wind"
  | "tide"
  | "current"
  | "waterTemperature";

export type TideDatum = "MSL" | "MLLW" | (string & {});

export type SurfForecastRequest = {
  point: LatLng;
  name?: string;
  start?: IsoDateTime;
  end?: IsoDateTime;
  hours?: number;
  timezone?: string;
  fields?: SurfDataField[];
  provider?: ProviderId | "auto";
  fallbackProviders?: ProviderId[];
  providerOptions?: Record<string, unknown>;
};

export type CanonicalUnits = {
  waveHeight: "m";
  wavePeriod: "s";
  windSpeed: "m/s";
  currentSpeed: "m/s";
  temperature: "C";
  direction: "deg";
};

export const CANONICAL_UNITS: CanonicalUnits = {
  waveHeight: "m",
  wavePeriod: "s",
  windSpeed: "m/s",
  currentSpeed: "m/s",
  temperature: "C",
  direction: "deg",
};

export type WaveReading = {
  heightM?: number;
  periodS?: number;
  directionFromDeg?: number;
};

export type SwellComponent = "primary" | "secondary" | "tertiary";

export type SwellReading = WaveReading & {
  component: SwellComponent;
};

export type WindReading = {
  speedMps?: number;
  gustMps?: number;
  directionFromDeg?: number;
};

export type TideReading = {
  heightM?: number;
  datum?: TideDatum;
};

export type TideEvent = {
  time: IsoDateTime;
  type: "high" | "low";
  heightM: number;
  datum?: TideDatum;
  station?: TideStation;
};

export type TideStation = {
  name?: string;
  point?: LatLng;
  distanceKm?: number;
  source?: string;
};

export type CurrentReading = {
  speedMps?: number;
  directionToDeg?: number;
};

export type SurfHour = {
  time: IsoDateTime;
  wave?: WaveReading;
  windWave?: WaveReading;
  swells?: SwellReading[];
  wind?: WindReading;
  tide?: TideReading;
  current?: CurrentReading;
  waterTempC?: number;
  sources?: Record<string, string>;
};

export type ProviderProvenance = {
  providerId: ProviderId;
  endpoint: string;
  fields: string[];
  nativeSource?: string;
  resolvedPoint?: LatLng;
  notes?: string[];
};

export type ProviderWarning = {
  providerId?: ProviderId;
  code: string;
  message: string;
  details?: unknown;
};

export type ProviderAttempt = {
  providerId: ProviderId;
  status: "skipped" | "failed" | "succeeded";
  code?: string;
  message?: string;
};

export type SurfForecast = {
  schemaVersion: "surf-forecast/v1";
  providerId: ProviderId;
  generatedAt: IsoDateTime;
  point: {
    requested: LatLng;
    resolved?: LatLng;
    name?: string;
  };
  hourly: SurfHour[];
  tides?: TideEvent[];
  units: CanonicalUnits;
  provenance: ProviderProvenance[];
  warnings: ProviderWarning[];
  meta: {
    providerAttempts: ProviderAttempt[];
    attribution?: string[];
    nativeSources?: string[];
  };
};

