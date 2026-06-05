#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import { loadRuntimeEnv } from "./config/env.js";
import {
  listSurfRegions,
  listSurfSpots,
  listSurfSpotsByRegion,
  resolveForecastPoint,
  resolveSurfSpot,
  SurfForecastService,
  SurfProviderError,
  type ProviderId,
  type SurfDataField,
  type SurfForecastRequest,
} from "./index.js";
import {
  projectOceanForecast,
  projectTideForecast,
  projectWaveForecast,
  projectWindForecast,
} from "./tools/projections.js";

loadRuntimeEnv();

type ProviderChoice = "auto" | "stormglass" | "open-meteo";

type BaseForecastToolArgs = {
  spot?: string | undefined;
  lat?: number | undefined;
  lng?: number | undefined;
  name?: string | undefined;
  provider?: ProviderChoice | undefined;
  fallbackProviders?: ("stormglass" | "open-meteo")[] | undefined;
  hours?: number | undefined;
  start?: string | undefined;
  end?: string | undefined;
  stormglassSource?: string | undefined;
  stormglassDatum?: "MSL" | "MLLW" | undefined;
};

const providerSchema = z
  .enum(["auto", "stormglass", "open-meteo"])
  .optional()
  .describe("Provider selection. Omit or use auto for Stormglass then Open-Meteo fallback.");

const fallbackProvidersSchema = z
  .array(z.enum(["stormglass", "open-meteo"]))
  .optional()
  .describe("Optional explicit fallback provider order.");

const hoursSchema = z
  .number()
  .int()
  .positive()
  .max(240)
  .optional()
  .describe("Forecast horizon in hours.");

const fieldsSchema = z
  .array(
    z.enum([
      "wave",
      "swell",
      "windWave",
      "wind",
      "tide",
      "current",
      "waterTemperature",
    ]),
  )
  .optional()
  .describe("Optional subset of canonical surf fields.");

const baseInputSchema = {
  spot: z
    .string()
    .optional()
    .describe("Known surf spot id or alias, e.g. steamer-lane or pleasure-point."),
  lat: z.number().optional().describe("Latitude. Required only when spot is omitted."),
  lng: z.number().optional().describe("Longitude. Required only when spot is omitted."),
  name: z.string().optional().describe("Optional human-readable spot name."),
  provider: providerSchema,
  fallbackProviders: fallbackProvidersSchema,
  hours: hoursSchema,
  start: z.string().optional().describe("Optional ISO start time."),
  end: z.string().optional().describe("Optional ISO end time."),
  stormglassSource: z
    .string()
    .optional()
    .describe("Stormglass native source selector, e.g. sg."),
  stormglassDatum: z
    .enum(["MSL", "MLLW"])
    .optional()
    .describe("Stormglass tide datum."),
} as const;

const service = new SurfForecastService();
const server = new McpServer({
  name: "surf-forecast-mcp",
  version: "0.1.0",
});

server.registerTool(
  "get_surf_forecast",
  {
    title: "Get Surf Forecast",
    description:
      "Fetch the full canonical surf forecast bundle. Defaults to Stormglass, then falls back to Open-Meteo when Stormglass is unavailable.",
    inputSchema: {
      ...baseInputSchema,
      fields: fieldsSchema,
    },
  },
  async (args) =>
    runTool(async () => {
      const forecast = await service.getForecast(forecastRequestFromToolArgs(args));
      return { forecast };
    }),
);

server.registerTool(
  "get_wave_forecast",
  {
    title: "Get Wave Forecast",
    description:
      "Fetch wave, wind-wave, and swell-component data as a focused forecast projection.",
    inputSchema: {
      ...baseInputSchema,
      includeWindWave: z.boolean().optional().describe("Include local wind-wave readings."),
      includeSwellComponents: z
        .boolean()
        .optional()
        .describe("Include primary/secondary/tertiary swell components."),
    },
  },
  async (args) =>
    runTool(async () => {
      const forecast = await service.getForecast(
        forecastRequestFromToolArgs(args, {
          fields: ["wave", "swell", "windWave"],
        }),
      );
      return {
        waveForecast: projectWaveForecast(forecast, {
          ...(args.includeWindWave !== undefined
            ? { includeWindWave: args.includeWindWave }
            : {}),
          ...(args.includeSwellComponents !== undefined
            ? { includeSwellComponents: args.includeSwellComponents }
            : {}),
        }),
      };
    }),
);

server.registerTool(
  "get_wind_forecast",
  {
    title: "Get Wind Forecast",
    description: "Fetch wind speed, direction, and optional gust forecast data.",
    inputSchema: {
      ...baseInputSchema,
      includeGusts: z.boolean().optional().describe("Include gust speed when available."),
    },
  },
  async (args) =>
    runTool(async () => {
      const forecast = await service.getForecast(
        forecastRequestFromToolArgs(args, {
          fields: ["wind"],
        }),
      );
      return {
        windForecast: projectWindForecast(forecast, {
          ...(args.includeGusts !== undefined ? { includeGusts: args.includeGusts } : {}),
        }),
      };
    }),
);

server.registerTool(
  "get_tide_forecast",
  {
    title: "Get Tide Forecast",
    description:
      "Fetch tide data. Stormglass returns tide extremes; Open-Meteo returns hourly sea-level height.",
    inputSchema: {
      ...baseInputSchema,
      mode: z
        .enum(["hourly", "extremes", "both"])
        .optional()
        .describe("Return hourly tide readings, tide extremes, or both."),
      datum: z
        .enum(["MSL", "MLLW"])
        .optional()
        .describe("Preferred tide datum. Maps to Stormglass datum."),
    },
  },
  async (args) =>
    runTool(async () => {
      const forecast = await service.getForecast(
        forecastRequestFromToolArgs(
          {
            ...args,
            stormglassDatum: args.datum ?? args.stormglassDatum,
          },
          {
            fields: ["tide"],
          },
        ),
      );
      return {
        tideForecast: projectTideForecast(forecast, args.mode ?? "both"),
      };
    }),
);

server.registerTool(
  "get_ocean_forecast",
  {
    title: "Get Ocean Forecast",
    description: "Fetch ocean current and water-temperature forecast data.",
    inputSchema: baseInputSchema,
  },
  async (args) =>
    runTool(async () => {
      const forecast = await service.getForecast(
        forecastRequestFromToolArgs(args, {
          fields: ["current", "waterTemperature"],
        }),
      );
      return {
        oceanForecast: projectOceanForecast(forecast),
      };
    }),
);

server.registerTool(
  "compare_surf_providers",
  {
    title: "Compare Surf Providers",
    description:
      "Fetch forecasts from multiple providers independently and return successes or provider-specific errors.",
    inputSchema: {
      spot: baseInputSchema.spot,
      lat: baseInputSchema.lat,
      lng: baseInputSchema.lng,
      name: z.string().optional().describe("Optional human-readable spot name."),
      providers: z
        .array(z.enum(["stormglass", "open-meteo"]))
        .optional()
        .describe("Providers to compare. Defaults to Stormglass and Open-Meteo."),
      hours: hoursSchema,
      start: z.string().optional().describe("Optional ISO start time."),
      end: z.string().optional().describe("Optional ISO end time."),
      fields: fieldsSchema,
      stormglassSource: baseInputSchema.stormglassSource,
      stormglassDatum: baseInputSchema.stormglassDatum,
    },
  },
  async (args) =>
    runTool(async () => {
      const baseRequest = forecastRequestFromToolArgs(args, { fields: args.fields });
      const providers = args.providers?.length
        ? args.providers
        : (["stormglass", "open-meteo"] as const);
      const forecasts = await Promise.all(
        providers.map(async (providerId) => {
          try {
            const forecast = await service.getForecast(
              forecastRequestFromToolArgs(
                {
                  ...args,
                  provider: providerId,
                },
                { fields: args.fields },
              ),
            );
            return {
              providerId,
              forecast,
            };
          } catch (error) {
            return {
              providerId,
              error: errorSummary(error),
            };
          }
        }),
      );

      return {
        comparison: {
          point: {
            requested: baseRequest.point,
            ...(baseRequest.name ? { name: baseRequest.name } : {}),
          },
          providers: forecasts,
        },
      };
    }),
);

server.registerTool(
  "list_surf_spots",
  {
    title: "List Surf Spots",
    description:
      "List known surf spots, aliases, coordinates, and lightweight preferences. Optionally filter by region id or alias.",
    inputSchema: {
      region: z
        .string()
        .optional()
        .describe("Optional surf region id or alias, e.g. north-cal or san-mateo-coast."),
    },
  },
  async (args) =>
    runTool(async () => ({
      ...(args.region ? { region: args.region } : {}),
      spots: args.region ? listSurfSpotsByRegion(args.region) : listSurfSpots(),
    })),
);

server.registerTool(
  "list_surf_regions",
  {
    title: "List Surf Regions",
    description: "List known surf regions and parent/child groupings.",
  },
  async () =>
    runTool(async () => ({
      regions: listSurfRegions(),
    })),
);

server.registerTool(
  "resolve_surf_spot",
  {
    title: "Resolve Surf Spot",
    description:
      "Resolve a surf spot id or alias to the catalog entry that forecast tools use.",
    inputSchema: {
      spot: z.string().describe("Surf spot id or alias."),
    },
  },
  async (args) =>
    runTool(async () => {
      const spot = resolveSurfSpot(args.spot);

      if (!spot) {
        throw new Error(`Unknown surf spot: ${args.spot}`);
      }

      return { spot };
    }),
);

server.registerTool(
  "list_surf_providers",
  {
    title: "List Surf Providers",
    description:
      "List surf data providers, capabilities, and current configuration status.",
  },
  async () =>
    runTool(async () => ({
      providers: service.listProviders().map((provider) => ({
        id: provider.id,
        displayName: provider.displayName,
        capabilities: provider.capabilities,
        config: provider.getConfigStatus(process.env),
      })),
    })),
);

await server.connect(new StdioServerTransport());

async function runTool(
  action: () => Promise<Record<string, unknown>> | Record<string, unknown>,
) {
  try {
    const payload = await action();
    return {
      structuredContent: payload,
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(payload, null, 2),
        },
      ],
    };
  } catch (error) {
    const payload = errorPayload(error);
    return {
      isError: true,
      structuredContent: payload,
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(payload, null, 2),
        },
      ],
    };
  }
}

function forecastRequestFromToolArgs(
  args: BaseForecastToolArgs,
  overrides: {
    fields?: SurfDataField[] | undefined;
  } = {},
): SurfForecastRequest {
  const providerOptions: Record<string, unknown> = {};
  const resolvedPoint = resolveForecastPoint({
    spot: args.spot,
    lat: args.lat,
    lng: args.lng,
    name: args.name,
  });

  if (args.stormglassSource) {
    providerOptions.source = args.stormglassSource;
  }

  if (args.stormglassDatum) {
    providerOptions.datum = args.stormglassDatum;
  }

  return {
    point: resolvedPoint.point,
    ...(resolvedPoint.name ? { name: resolvedPoint.name } : {}),
    ...(args.provider && args.provider !== "auto"
      ? { provider: args.provider as ProviderId }
      : {}),
    ...(args.fallbackProviders?.length
      ? { fallbackProviders: args.fallbackProviders as ProviderId[] }
      : {}),
    ...(args.hours !== undefined ? { hours: args.hours } : {}),
    ...(args.start ? { start: args.start } : {}),
    ...(args.end ? { end: args.end } : {}),
    ...(overrides.fields?.length ? { fields: overrides.fields } : {}),
    ...(Object.keys(providerOptions).length ? { providerOptions } : {}),
  };
}

function errorPayload(error: unknown): Record<string, unknown> {
  return { error: errorSummary(error) };
}

function errorSummary(error: unknown) {
  if (error instanceof SurfProviderError) {
    return {
      name: error.name,
      providerId: error.providerId,
      code: error.code,
      retryable: error.retryable,
      message: error.message,
      details: error.details,
    };
  }

  return {
    name: error instanceof Error ? error.name : "Error",
    message: error instanceof Error ? error.message : String(error),
  };
}
