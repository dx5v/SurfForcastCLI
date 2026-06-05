import type { LatLng } from "../domain/surf.js";

export type SurfSpot = {
  id: string;
  name: string;
  region: string;
  aliases: string[];
  point: LatLng;
  timezone: string;
  notes?: string;
  preferredSwellFromDeg?: [number, number][];
  preferredWindFromDeg?: [number, number][];
  tidePreference?: "low" | "mid" | "high" | "rising" | "falling";
};

export type ResolvedForecastPoint = {
  point: LatLng;
  name?: string;
  spot?: SurfSpot;
};

export const SURF_SPOTS: SurfSpot[] = [
  {
    id: "steamer-lane",
    name: "Steamer Lane",
    region: "Santa Cruz, CA",
    aliases: ["steamer", "the lane", "lane", "steamers"],
    point: { lat: 36.951, lng: -122.026 },
    timezone: "America/Los_Angeles",
    preferredSwellFromDeg: [[260, 310]],
    preferredWindFromDeg: [[20, 120]],
  },
  {
    id: "pleasure-point",
    name: "Pleasure Point",
    region: "Santa Cruz, CA",
    aliases: ["pleasure", "pleasure pt", "36th", "pleasure point"],
    point: { lat: 36.958, lng: -121.971 },
    timezone: "America/Los_Angeles",
    preferredSwellFromDeg: [[250, 300]],
    preferredWindFromDeg: [[20, 120]],
  },
  {
    id: "cowells",
    name: "Cowells",
    region: "Santa Cruz, CA",
    aliases: ["cowell", "cowell beach", "cowells beach"],
    point: { lat: 36.961, lng: -122.025 },
    timezone: "America/Los_Angeles",
    tidePreference: "mid",
  },
  {
    id: "four-mile",
    name: "Four Mile",
    region: "Santa Cruz, CA",
    aliases: ["4 mile", "four mile beach", "4-mile"],
    point: { lat: 36.963, lng: -122.12 },
    timezone: "America/Los_Angeles",
  },
  {
    id: "waddell-creek",
    name: "Waddell Creek",
    region: "Santa Cruz County, CA",
    aliases: ["waddell", "waddell beach"],
    point: { lat: 37.096, lng: -122.281 },
    timezone: "America/Los_Angeles",
  },
  {
    id: "manresa",
    name: "Manresa",
    region: "Santa Cruz County, CA",
    aliases: ["manresa beach", "manresa state beach"],
    point: { lat: 36.927, lng: -121.863 },
    timezone: "America/Los_Angeles",
  },
  {
    id: "the-hook",
    name: "The Hook",
    region: "Santa Cruz, CA",
    aliases: ["hook", "41st", "41st ave"],
    point: { lat: 36.958, lng: -121.965 },
    timezone: "America/Los_Angeles",
  },
  {
    id: "capitola",
    name: "Capitola",
    region: "Santa Cruz County, CA",
    aliases: ["capitola beach", "capitola jetty"],
    point: { lat: 36.972, lng: -121.953 },
    timezone: "America/Los_Angeles",
  },
];

const SPOT_INDEX = new Map<string, SurfSpot>(
  SURF_SPOTS.flatMap((spot) => [
    [normalizeSpotKey(spot.id), spot],
    [normalizeSpotKey(spot.name), spot],
    ...spot.aliases.map((alias) => [normalizeSpotKey(alias), spot] as const),
  ]),
);

export function listSurfSpots(): SurfSpot[] {
  return [...SURF_SPOTS];
}

export function resolveSurfSpot(query: string): SurfSpot | undefined {
  return SPOT_INDEX.get(normalizeSpotKey(query));
}

export function resolveForecastPoint(input: {
  spot?: string | undefined;
  lat?: number | undefined;
  lng?: number | undefined;
  name?: string | undefined;
}): ResolvedForecastPoint {
  if (input.spot) {
    const spot = resolveSurfSpot(input.spot);

    if (!spot) {
      throw new Error(`Unknown surf spot: ${input.spot}`);
    }

    return {
      point: spot.point,
      name: input.name ?? spot.name,
      spot,
    };
  }

  if (input.lat === undefined || input.lng === undefined) {
    throw new Error("Provide either a known spot or both lat and lng.");
  }

  return {
    point: { lat: input.lat, lng: input.lng },
    ...(input.name ? { name: input.name } : {}),
  };
}

function normalizeSpotKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

