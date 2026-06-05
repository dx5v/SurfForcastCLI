import type {
  CanonicalUnits,
  CurrentReading,
  ProviderAttempt,
  ProviderId,
  ProviderProvenance,
  ProviderWarning,
  SurfForecast,
  SwellReading,
  TideEvent,
  TideReading,
  WaveReading,
  WindReading,
} from "../domain/surf.js";

export type ProjectionMeta = {
  providerAttempts: ProviderAttempt[];
  attribution?: string[];
  nativeSources?: string[];
};

export type ProjectedForecastBase = {
  providerId: ProviderId;
  generatedAt: string;
  point: SurfForecast["point"];
  provenance: ProviderProvenance[];
  warnings: ProviderWarning[];
  meta: ProjectionMeta;
};

export type WaveForecastProjection = ProjectedForecastBase & {
  hourly: {
    time: string;
    wave?: WaveReading;
    windWave?: WaveReading;
    swells?: SwellReading[];
    sources?: Record<string, string>;
  }[];
  units: Pick<CanonicalUnits, "waveHeight" | "wavePeriod" | "direction">;
};

export type WindForecastProjection = ProjectedForecastBase & {
  hourly: {
    time: string;
    wind?: WindReading;
    sources?: Record<string, string>;
  }[];
  units: Pick<CanonicalUnits, "windSpeed" | "direction">;
};

export type TideForecastProjection = ProjectedForecastBase & {
  hourly?: {
    time: string;
    tide?: TideReading;
    sources?: Record<string, string>;
  }[];
  extremes?: TideEvent[];
  units: {
    tideHeight: "m";
  };
};

export type OceanForecastProjection = ProjectedForecastBase & {
  hourly: {
    time: string;
    current?: CurrentReading;
    waterTempC?: number;
    sources?: Record<string, string>;
  }[];
  units: Pick<CanonicalUnits, "currentSpeed" | "direction" | "temperature">;
};

export type ProviderComparisonProjection = {
  point: SurfForecast["point"];
  providers: {
    providerId: ProviderId;
    forecast?: SurfForecast;
    error?: {
      name: string;
      code?: string;
      retryable?: boolean;
      message: string;
      details?: unknown;
    };
  }[];
};

export function projectWaveForecast(
  forecast: SurfForecast,
  options: {
    includeWindWave?: boolean;
    includeSwellComponents?: boolean;
  } = {},
): WaveForecastProjection {
  return {
    ...forecastBase(forecast),
    hourly: forecast.hourly.map((hour) => ({
      time: hour.time,
      ...(hour.wave ? { wave: hour.wave } : {}),
      ...(options.includeWindWave !== false && hour.windWave
        ? { windWave: hour.windWave }
        : {}),
      ...(options.includeSwellComponents !== false && hour.swells
        ? { swells: hour.swells }
        : {}),
      ...(hour.sources ? { sources: hour.sources } : {}),
    })),
    units: {
      waveHeight: forecast.units.waveHeight,
      wavePeriod: forecast.units.wavePeriod,
      direction: forecast.units.direction,
    },
  };
}

export function projectWindForecast(
  forecast: SurfForecast,
  options: {
    includeGusts?: boolean;
  } = {},
): WindForecastProjection {
  return {
    ...forecastBase(forecast),
    hourly: forecast.hourly.map((hour) => ({
      time: hour.time,
      ...(hour.wind
        ? {
            wind:
              options.includeGusts === false
                ? omitGust(hour.wind)
                : hour.wind,
          }
        : {}),
      ...(hour.sources ? { sources: hour.sources } : {}),
    })),
    units: {
      windSpeed: forecast.units.windSpeed,
      direction: forecast.units.direction,
    },
  };
}

export function projectTideForecast(
  forecast: SurfForecast,
  mode: "hourly" | "extremes" | "both" = "both",
): TideForecastProjection {
  return {
    ...forecastBase(forecast),
    ...(mode === "hourly" || mode === "both"
      ? {
          hourly: forecast.hourly.map((hour) => ({
            time: hour.time,
            ...(hour.tide ? { tide: hour.tide } : {}),
            ...(hour.sources ? { sources: hour.sources } : {}),
          })),
        }
      : {}),
    ...(mode === "extremes" || mode === "both"
      ? forecast.tides
        ? { extremes: forecast.tides }
        : {}
      : {}),
    units: {
      tideHeight: "m",
    },
  };
}

export function projectOceanForecast(forecast: SurfForecast): OceanForecastProjection {
  return {
    ...forecastBase(forecast),
    hourly: forecast.hourly.map((hour) => ({
      time: hour.time,
      ...(hour.current ? { current: hour.current } : {}),
      ...(hour.waterTempC !== undefined ? { waterTempC: hour.waterTempC } : {}),
      ...(hour.sources ? { sources: hour.sources } : {}),
    })),
    units: {
      currentSpeed: forecast.units.currentSpeed,
      direction: forecast.units.direction,
      temperature: forecast.units.temperature,
    },
  };
}

function forecastBase(forecast: SurfForecast): ProjectedForecastBase {
  return {
    providerId: forecast.providerId,
    generatedAt: forecast.generatedAt,
    point: forecast.point,
    provenance: forecast.provenance,
    warnings: forecast.warnings,
    meta: forecast.meta,
  };
}

function omitGust(wind: WindReading): WindReading {
  return {
    ...(wind.speedMps !== undefined ? { speedMps: wind.speedMps } : {}),
    ...(wind.directionFromDeg !== undefined
      ? { directionFromDeg: wind.directionFromDeg }
      : {}),
  };
}

