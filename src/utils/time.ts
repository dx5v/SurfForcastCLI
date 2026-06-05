import type { IsoDateTime } from "../domain/surf.js";

export type ForecastWindow = {
  start: Date;
  end: Date;
  hours: number;
};

export function resolveForecastWindow(input: {
  now: Date;
  start?: IsoDateTime | undefined;
  end?: IsoDateTime | undefined;
  hours?: number | undefined;
}): ForecastWindow {
  const hours = positiveInteger(input.hours ?? 48, "hours");
  const start = input.start ? parseDate(input.start, "start") : floorToHour(input.now);
  const end = input.end
    ? parseDate(input.end, "end")
    : new Date(start.getTime() + hours * 60 * 60 * 1000);

  if (end <= start) {
    throw new Error("Forecast end must be after start.");
  }

  return { start, end, hours };
}

export function toUtcIso(date: Date): string {
  return date.toISOString();
}

export function openMeteoTimeToUtcIso(time: string): string {
  return time.endsWith("Z") || /[+-]\d\d:\d\d$/.test(time) ? time : `${time}:00Z`;
}

export function takeForecastHours<T extends { time: string }>(
  rows: T[],
  window: ForecastWindow,
): T[] {
  return rows
    .filter((row) => {
      const time = new Date(row.time);
      return time >= window.start && time <= window.end;
    })
    .slice(0, window.hours);
}

function parseDate(value: string, fieldName: string): Date {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} must be a parseable ISO date/time.`);
  }

  return date;
}

function floorToHour(value: Date): Date {
  const date = new Date(value);
  date.setUTCMinutes(0, 0, 0);
  return date;
}

function positiveInteger(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }

  return value;
}
