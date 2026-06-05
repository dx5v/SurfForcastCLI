#!/usr/bin/env node

import {
  SurfForecastService,
  SurfProviderError,
  type ProviderId,
  type SurfDataField,
  type SurfForecastRequest,
} from "./index.js";

type CliArgs = Record<string, string>;

const DEFAULT_POINT = {
  name: "Steamer Lane, Santa Cruz",
  lat: 36.951,
  lng: -122.026,
};

const command = process.argv[2] ?? "forecast";
const args = parseArgs(process.argv.slice(3));
const service = new SurfForecastService();

try {
  switch (command) {
    case "forecast":
      await printForecast(args, service);
      break;
    case "providers":
      printProviders(service);
      break;
    case "help":
    case "--help":
    case "-h":
      printHelp();
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
} catch (error) {
  printError(error);
  process.exitCode = 1;
}

async function printForecast(
  args: CliArgs,
  service: SurfForecastService,
): Promise<void> {
  const request = forecastRequestFromArgs(args);
  const forecast = await service.getForecast(request);
  writeJson(forecast);
}

function printProviders(service: SurfForecastService): void {
  const providers = service.listProviders().map((provider) => ({
    id: provider.id,
    displayName: provider.displayName,
    capabilities: provider.capabilities,
    config: provider.getConfigStatus(process.env),
  }));

  writeJson({ providers });
}

function forecastRequestFromArgs(args: CliArgs): SurfForecastRequest {
  const lat = numberArg(args, "lat", undefined) ?? DEFAULT_POINT.lat;
  const lng = numberArg(args, "lng", undefined) ?? DEFAULT_POINT.lng;
  const name = stringArg(args, "name", DEFAULT_POINT.name);
  const provider = stringArg(args, "provider", "auto");
  const fallbackProviders = listArg(args, "fallback").map((value) => value as ProviderId);
  const fields = listArg(args, "fields").map((value) => value as SurfDataField);
  const providerOptions = providerOptionsFromArgs(args);
  const hours = numberArg(args, "hours", undefined);
  const start = stringArg(args, "start", undefined);
  const end = stringArg(args, "end", undefined);
  const timezone = stringArg(args, "timezone", undefined);

  return {
    point: { lat, lng },
    ...(name ? { name } : {}),
    ...(hours !== undefined ? { hours } : {}),
    ...(start ? { start } : {}),
    ...(end ? { end } : {}),
    ...(timezone ? { timezone } : {}),
    ...(provider !== "auto" ? { provider: provider as ProviderId } : {}),
    ...(fallbackProviders.length ? { fallbackProviders } : {}),
    ...(fields.length ? { fields } : {}),
    ...(Object.keys(providerOptions).length ? { providerOptions } : {}),
  };
}

function providerOptionsFromArgs(args: CliArgs): Record<string, unknown> {
  const options: Record<string, unknown> = {};
  const stormglassSource = stringArg(args, "stormglass-source", undefined);
  const stormglassDatum = stringArg(args, "stormglass-datum", undefined);

  if (stormglassSource) {
    options.source = stormglassSource;
  }

  if (stormglassDatum) {
    options.datum = stormglassDatum;
  }

  return options;
}

function printHelp(): void {
  process.stdout.write(`surf-forecast

Commands:
  forecast   Fetch a canonical surf forecast as JSON
  providers  List providers, capabilities, and config status

Examples:
  npm run forecast -- --lat 36.951 --lng -122.026 --hours 12
  npm run forecast -- --provider open-meteo --hours 12
  npm run providers

Options:
  --lat <number>
  --lng <number>
  --name <label>
  --provider <auto|stormglass|open-meteo>
  --fallback <comma-separated-provider-ids>
  --hours <positive integer>
  --start <ISO datetime>
  --end <ISO datetime>
  --fields <comma-separated fields>
  --stormglass-source <source>
  --stormglass-datum <MSL|MLLW>
`);
}

function printError(error: unknown): void {
  const payload =
    error instanceof SurfProviderError
      ? {
          error: {
            name: error.name,
            providerId: error.providerId,
            code: error.code,
            retryable: error.retryable,
            message: error.message,
            details: error.details,
          },
        }
      : {
          error: {
            name: error instanceof Error ? error.name : "Error",
            message: error instanceof Error ? error.message : String(error),
          },
        };

  process.stderr.write(`${JSON.stringify(payload, null, 2)}\n`);
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

function stringArg(
  args: CliArgs,
  key: string,
  fallback: string | undefined,
): string | undefined {
  return args[key] ?? fallback;
}

function numberArg(
  args: CliArgs,
  key: string,
  fallback: number | undefined,
): number | undefined {
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

function listArg(args: CliArgs, key: string): string[] {
  return (args[key] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
