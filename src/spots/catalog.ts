import type { LatLng } from "../domain/surf.js";

export type SurfSpot = {
  id: string;
  name: string;
  regionId: string;
  region: string;
  aliases: string[];
  point: LatLng;
  timezone: string;
  notes?: string;
  preferredSwellFromDeg?: [number, number][];
  preferredWindFromDeg?: [number, number][];
  tidePreference?: "low" | "mid" | "high" | "rising" | "falling";
};

export type SurfRegion = {
  id: string;
  name: string;
  aliases: string[];
  parentId?: string;
  description?: string;
  timezone: string;
};

export type ResolvedForecastPoint = {
  point: LatLng;
  name?: string;
  spot?: SurfSpot;
};

export const SURF_SPOTS: SurfSpot[] = [
  {
    id: "moonstone-beach",
    name: "Moonstone Beach",
    regionId: "humboldt",
    region: "Humboldt, CA",
    aliases: ["moonstone", "moonstone humboldt"],
    point: { lat: 41.041, lng: -124.116 },
    timezone: "America/Los_Angeles",
  },
  {
    id: "south-beach-crescent-city",
    name: "South Beach Crescent City",
    regionId: "del-norte",
    region: "Del Norte, CA",
    aliases: ["south beach", "crescent city south beach"],
    point: { lat: 41.741, lng: -124.185 },
    timezone: "America/Los_Angeles",
  },
  {
    id: "caspar-beach",
    name: "Caspar Beach",
    regionId: "mendocino",
    region: "Mendocino, CA",
    aliases: ["caspar", "caspar creek"],
    point: { lat: 39.363, lng: -123.816 },
    timezone: "America/Los_Angeles",
  },
  {
    id: "point-arena",
    name: "Point Arena",
    regionId: "mendocino",
    region: "Mendocino, CA",
    aliases: ["arena cove", "point arena cove"],
    point: { lat: 38.914, lng: -123.71 },
    timezone: "America/Los_Angeles",
  },
  {
    id: "salmon-creek",
    name: "Salmon Creek",
    regionId: "sonoma-marin",
    region: "Sonoma Coast, CA",
    aliases: ["salmon creek beach", "salmon"],
    point: { lat: 38.348, lng: -123.068 },
    timezone: "America/Los_Angeles",
  },
  {
    id: "dillon-beach",
    name: "Dillon Beach",
    regionId: "sonoma-marin",
    region: "Marin, CA",
    aliases: ["dillon"],
    point: { lat: 38.25, lng: -122.968 },
    timezone: "America/Los_Angeles",
  },
  {
    id: "bolinas",
    name: "Bolinas",
    regionId: "sonoma-marin",
    region: "Marin, CA",
    aliases: ["bolinas beach", "bolinas patch", "the patch"],
    point: { lat: 37.909, lng: -122.686 },
    timezone: "America/Los_Angeles",
  },
  {
    id: "stinson-beach",
    name: "Stinson Beach",
    regionId: "sonoma-marin",
    region: "Marin, CA",
    aliases: ["stinson"],
    point: { lat: 37.9, lng: -122.645 },
    timezone: "America/Los_Angeles",
  },
  {
    id: "ocean-beach-sf",
    name: "Ocean Beach SF",
    regionId: "san-francisco-pacifica",
    region: "San Francisco, CA",
    aliases: ["ocean beach", "ob", "ob sf", "kellys cove", "kelly's cove"],
    point: { lat: 37.759, lng: -122.511 },
    timezone: "America/Los_Angeles",
  },
  {
    id: "linda-mar",
    name: "Linda Mar",
    regionId: "san-francisco-pacifica",
    region: "Pacifica, CA",
    aliases: ["pacifica", "pacifica state beach", "linda mar beach"],
    point: { lat: 37.598, lng: -122.503 },
    timezone: "America/Los_Angeles",
  },
  {
    id: "rockaway",
    name: "Rockaway",
    regionId: "san-francisco-pacifica",
    region: "Pacifica, CA",
    aliases: ["rockaway beach", "rockaway pacifica"],
    point: { lat: 37.609, lng: -122.499 },
    timezone: "America/Los_Angeles",
  },
  {
    id: "montara",
    name: "Montara",
    regionId: "san-mateo-coast",
    region: "San Mateo Coast, CA",
    aliases: ["montara beach"],
    point: { lat: 37.545, lng: -122.515 },
    timezone: "America/Los_Angeles",
  },
  {
    id: "mavericks",
    name: "Mavericks",
    regionId: "san-mateo-coast",
    region: "Half Moon Bay, CA",
    aliases: ["mavericks beach", "maverick's", "pillar point"],
    point: { lat: 37.494, lng: -122.501 },
    timezone: "America/Los_Angeles",
    notes: "Big-wave spot. Coordinate is an approximate forecast point near Pillar Point.",
  },
  {
    id: "princeton-jetty",
    name: "Princeton Jetty",
    regionId: "san-mateo-coast",
    region: "Half Moon Bay, CA",
    aliases: ["princeton", "hmb jetty", "half moon bay jetty"],
    point: { lat: 37.5, lng: -122.475 },
    timezone: "America/Los_Angeles",
  },
  {
    id: "half-moon-bay",
    name: "Half Moon Bay",
    regionId: "san-mateo-coast",
    region: "Half Moon Bay, CA",
    aliases: ["hmb", "half moon bay state beach"],
    point: { lat: 37.466, lng: -122.445 },
    timezone: "America/Los_Angeles",
  },
  {
    id: "davenport",
    name: "Davenport",
    regionId: "santa-cruz",
    region: "Santa Cruz County, CA",
    aliases: ["davenport landing"],
    point: { lat: 37.025, lng: -122.217 },
    timezone: "America/Los_Angeles",
  },
  {
    id: "steamer-lane",
    name: "Steamer Lane",
    regionId: "santa-cruz",
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
    regionId: "santa-cruz",
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
    regionId: "santa-cruz",
    region: "Santa Cruz, CA",
    aliases: ["cowell", "cowell beach", "cowells beach"],
    point: { lat: 36.961, lng: -122.025 },
    timezone: "America/Los_Angeles",
    tidePreference: "mid",
  },
  {
    id: "four-mile",
    name: "Four Mile",
    regionId: "santa-cruz",
    region: "Santa Cruz, CA",
    aliases: ["4 mile", "four mile beach", "4-mile"],
    point: { lat: 36.963, lng: -122.12 },
    timezone: "America/Los_Angeles",
  },
  {
    id: "waddell-creek",
    name: "Waddell Creek",
    regionId: "santa-cruz",
    region: "Santa Cruz County, CA",
    aliases: ["waddell", "waddell beach"],
    point: { lat: 37.096, lng: -122.281 },
    timezone: "America/Los_Angeles",
  },
  {
    id: "manresa",
    name: "Manresa",
    regionId: "santa-cruz",
    region: "Santa Cruz County, CA",
    aliases: ["manresa beach", "manresa state beach"],
    point: { lat: 36.927, lng: -121.863 },
    timezone: "America/Los_Angeles",
  },
  {
    id: "the-hook",
    name: "The Hook",
    regionId: "santa-cruz",
    region: "Santa Cruz, CA",
    aliases: ["hook", "41st", "41st ave"],
    point: { lat: 36.958, lng: -121.965 },
    timezone: "America/Los_Angeles",
  },
  {
    id: "capitola",
    name: "Capitola",
    regionId: "santa-cruz",
    region: "Santa Cruz County, CA",
    aliases: ["capitola beach", "capitola jetty"],
    point: { lat: 36.972, lng: -121.953 },
    timezone: "America/Los_Angeles",
  },
];

export const SURF_REGIONS: SurfRegion[] = [
  {
    id: "north-cal",
    name: "Northern California",
    aliases: ["norcal", "northcal", "north cal", "northern california"],
    timezone: "America/Los_Angeles",
    description: "Starter grouping for Del Norte through Santa Cruz.",
  },
  {
    id: "del-norte",
    name: "Del Norte",
    aliases: ["crescent city", "del norte"],
    parentId: "north-cal",
    timezone: "America/Los_Angeles",
  },
  {
    id: "humboldt",
    name: "Humboldt",
    aliases: ["humboldt", "arcata", "trinidad"],
    parentId: "north-cal",
    timezone: "America/Los_Angeles",
  },
  {
    id: "mendocino",
    name: "Mendocino",
    aliases: ["mendo", "mendocino"],
    parentId: "north-cal",
    timezone: "America/Los_Angeles",
  },
  {
    id: "sonoma-marin",
    name: "Sonoma / Marin",
    aliases: ["sonoma", "marin", "sonoma coast", "marin county"],
    parentId: "north-cal",
    timezone: "America/Los_Angeles",
  },
  {
    id: "san-francisco-pacifica",
    name: "San Francisco / Pacifica",
    aliases: ["san francisco", "sf", "pacifica"],
    parentId: "north-cal",
    timezone: "America/Los_Angeles",
  },
  {
    id: "san-mateo-coast",
    name: "San Mateo Coast",
    aliases: ["san mateo", "half moon bay", "hmb"],
    parentId: "north-cal",
    timezone: "America/Los_Angeles",
  },
  {
    id: "santa-cruz",
    name: "Santa Cruz",
    aliases: ["santa cruz", "sc"],
    parentId: "north-cal",
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

const REGION_INDEX = new Map<string, SurfRegion>(
  SURF_REGIONS.flatMap((region) => [
    [normalizeSpotKey(region.id), region],
    [normalizeSpotKey(region.name), region],
    ...region.aliases.map((alias) => [normalizeSpotKey(alias), region] as const),
  ]),
);

export function listSurfSpots(): SurfSpot[] {
  return [...SURF_SPOTS];
}

export function listSurfRegions(): SurfRegion[] {
  return [...SURF_REGIONS];
}

export function listSurfSpotsByRegion(regionQuery: string): SurfSpot[] {
  const region = resolveSurfRegion(regionQuery);

  if (!region) {
    throw new Error(`Unknown surf region: ${regionQuery}`);
  }

  const regionIds = new Set([
    region.id,
    ...SURF_REGIONS.filter((candidate) => candidate.parentId === region.id).map(
      (candidate) => candidate.id,
    ),
  ]);

  return SURF_SPOTS.filter((spot) => regionIds.has(spot.regionId));
}

export function resolveSurfSpot(query: string): SurfSpot | undefined {
  return SPOT_INDEX.get(normalizeSpotKey(query));
}

export function resolveSurfRegion(query: string): SurfRegion | undefined {
  return REGION_INDEX.get(normalizeSpotKey(query));
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
