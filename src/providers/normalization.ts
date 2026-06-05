import type {
  CurrentReading,
  SwellReading,
  SwellComponent,
  TideEvent,
  TideStation,
  WaveReading,
  WindReading,
} from "../domain/surf.js";

type MaybeWaveReading = {
  heightM?: number | undefined;
  periodS?: number | undefined;
  directionFromDeg?: number | undefined;
};

type MaybeSwellReading = MaybeWaveReading & {
  component: SwellComponent;
};

type MaybeWindReading = {
  speedMps?: number | undefined;
  gustMps?: number | undefined;
  directionFromDeg?: number | undefined;
};

type MaybeCurrentReading = {
  speedMps?: number | undefined;
  directionToDeg?: number | undefined;
};

export function maybeWave(input: MaybeWaveReading): WaveReading | undefined {
  const reading: WaveReading = {};

  if (input.heightM !== undefined) {
    reading.heightM = input.heightM;
  }

  if (input.periodS !== undefined) {
    reading.periodS = input.periodS;
  }

  if (input.directionFromDeg !== undefined) {
    reading.directionFromDeg = input.directionFromDeg;
  }

  return hasDefinedValue(reading) ? reading : undefined;
}

export function maybeWind(input: MaybeWindReading): WindReading | undefined {
  const reading: WindReading = {};

  if (input.speedMps !== undefined) {
    reading.speedMps = input.speedMps;
  }

  if (input.gustMps !== undefined) {
    reading.gustMps = input.gustMps;
  }

  if (input.directionFromDeg !== undefined) {
    reading.directionFromDeg = input.directionFromDeg;
  }

  return hasDefinedValue(reading) ? reading : undefined;
}

export function maybeCurrent(input: MaybeCurrentReading): CurrentReading | undefined {
  const reading: CurrentReading = {};

  if (input.speedMps !== undefined) {
    reading.speedMps = input.speedMps;
  }

  if (input.directionToDeg !== undefined) {
    reading.directionToDeg = input.directionToDeg;
  }

  return hasDefinedValue(reading) ? reading : undefined;
}

export function compactSwells(swells: MaybeSwellReading[]): SwellReading[] | undefined {
  const compacted = swells.flatMap((swell): SwellReading[] => {
    const reading = maybeWave({
      heightM: swell.heightM,
      periodS: swell.periodS,
      directionFromDeg: swell.directionFromDeg,
    });

    if (!reading) {
      return [];
    }

    return [{ component: swell.component, ...reading }];
  });
  return compacted.length ? compacted : undefined;
}

export function compactTides(tides: TideEvent[]): TideEvent[] | undefined {
  return tides.length ? tides : undefined;
}

export function compactStation(
  station: {
    name?: string | undefined;
    point?: TideStation["point"] | undefined;
    distanceKm?: number | undefined;
    source?: string | undefined;
  },
): TideStation | undefined {
  const compacted: TideStation = {};

  if (station.name !== undefined) {
    compacted.name = station.name;
  }

  if (station.point !== undefined) {
    compacted.point = station.point;
  }

  if (station.distanceKm !== undefined) {
    compacted.distanceKm = station.distanceKm;
  }

  if (station.source !== undefined) {
    compacted.source = station.source;
  }

  return hasDefinedValue(compacted) ? compacted : undefined;
}

export function kmhToMps(value: number | undefined): number | undefined {
  return value === undefined ? undefined : value / 3.6;
}

export function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function hasDefinedValue(value: object): boolean {
  return Object.values(value).some((field) => field !== undefined);
}
