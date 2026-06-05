#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import {
  SurfForecastService,
  SurfProviderError,
  type ProviderId,
  type SurfDataField,
  type SurfForecastRequest,
} from "./index.js";

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
      "Fetch canonical surf forecast data. Defaults to Stormglass, then falls back to Open-Meteo when Stormglass is unavailable.",
    inputSchema: {
      lat: z.number().describe("Latitude of the surf spot."),
      lng: z.number().describe("Longitude of the surf spot."),
      name: z.string().optional().describe("Optional human-readable spot name."),
      provider: z
        .enum(["auto", "stormglass", "open-meteo"])
        .optional()
        .describe("Provider selection. Omit or use auto for Stormglass then Open-Meteo fallback."),
      fallbackProviders: z
        .array(z.enum(["stormglass", "open-meteo"]))
        .optional()
        .describe("Optional explicit fallback provider order."),
      hours: z
        .number()
        .int()
        .positive()
        .max(240)
        .optional()
        .describe("Forecast horizon in hours."),
      start: z.string().optional().describe("Optional ISO start time."),
      end: z.string().optional().describe("Optional ISO end time."),
      fields: z
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
        .describe("Optional subset of canonical surf fields."),
      stormglassSource: z
        .string()
        .optional()
        .describe("Stormglass native source selector, e.g. sg."),
      stormglassDatum: z
        .enum(["MSL", "MLLW"])
        .optional()
        .describe("Stormglass tide datum."),
    },
  },
  async (args) => {
    try {
      const request = forecastRequestFromToolArgs(args);
      const forecast = await service.getForecast(request);
      return {
        structuredContent: { forecast },
        content: [
          {
            type: "text",
            text: JSON.stringify(forecast, null, 2),
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
            type: "text",
            text: JSON.stringify(payload, null, 2),
          },
        ],
      };
    }
  },
);

server.registerTool(
  "list_surf_providers",
  {
    title: "List Surf Providers",
    description:
      "List surf data providers, capabilities, and current configuration status.",
  },
  async () => {
    const providers = service.listProviders().map((provider) => ({
      id: provider.id,
      displayName: provider.displayName,
      capabilities: provider.capabilities,
      config: provider.getConfigStatus(process.env),
    }));
    const payload = { providers };

    return {
      structuredContent: payload,
      content: [
        {
          type: "text",
          text: JSON.stringify(payload, null, 2),
        },
      ],
    };
  },
);

await server.connect(new StdioServerTransport());

function forecastRequestFromToolArgs(args: {
  lat: number;
  lng: number;
  name?: string | undefined;
  provider?: "auto" | "stormglass" | "open-meteo" | undefined;
  fallbackProviders?: ("stormglass" | "open-meteo")[] | undefined;
  hours?: number | undefined;
  start?: string | undefined;
  end?: string | undefined;
  fields?: SurfDataField[] | undefined;
  stormglassSource?: string | undefined;
  stormglassDatum?: "MSL" | "MLLW" | undefined;
}): SurfForecastRequest {
  const providerOptions: Record<string, unknown> = {};

  if (args.stormglassSource) {
    providerOptions.source = args.stormglassSource;
  }

  if (args.stormglassDatum) {
    providerOptions.datum = args.stormglassDatum;
  }

  return {
    point: { lat: args.lat, lng: args.lng },
    ...(args.name ? { name: args.name } : {}),
    ...(args.provider && args.provider !== "auto"
      ? { provider: args.provider as ProviderId }
      : {}),
    ...(args.fallbackProviders?.length
      ? { fallbackProviders: args.fallbackProviders as ProviderId[] }
      : {}),
    ...(args.hours !== undefined ? { hours: args.hours } : {}),
    ...(args.start ? { start: args.start } : {}),
    ...(args.end ? { end: args.end } : {}),
    ...(args.fields?.length ? { fields: args.fields } : {}),
    ...(Object.keys(providerOptions).length ? { providerOptions } : {}),
  };
}

function errorPayload(error: unknown): Record<string, unknown> {
  if (error instanceof SurfProviderError) {
    return {
      error: {
        name: error.name,
        providerId: error.providerId,
        code: error.code,
        retryable: error.retryable,
        message: error.message,
        details: error.details,
      },
    };
  }

  return {
    error: {
      name: error instanceof Error ? error.name : "Error",
      message: error instanceof Error ? error.message : String(error),
    },
  };
}

