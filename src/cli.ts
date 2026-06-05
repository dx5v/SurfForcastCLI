#!/usr/bin/env node

import {
  listSurfSpots,
  resolveForecastPoint,
  SurfForecastService,
  SurfProviderError,
  type ProviderId,
  type SurfDataField,
  type SurfForecastRequest,
} from "./index.js";

type CliArgs = Record<string, string>;

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
    case "spots":
      printSpots();
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

function printSpots(): void {
  writeJson({ spots: listSurfSpots() });
}

function forecastRequestFromArgs(args: CliArgs): SurfForecastRequest {
  const spot = stringArg(args, "spot", undefined);
  const lat = numberArg(args, "lat", undefined);
  const lng = numberArg(args, "lng", undefined);
  const name = stringArg(args, "name", undefined);
  const resolvedPoint = resolveForecastPoint({ spot, lat, lng, name });
  const provider = stringArg(args, "provider", "auto");
  const fallbackProviders = listArg(args, "fallback").map((value) => value as ProviderId);
  const fields = listArg(args, "fields").map((value) => value as SurfDataField);
  const providerOptions = providerOptionsFromArgs(args);
  const hours = numberArg(args, "hours", undefined);
  const start = stringArg(args, "start", undefined);
  const end = stringArg(args, "end", undefined);
  const timezone = stringArg(args, "timezone", undefined);

  return {
    point: resolvedPoint.point,
    ...(resolvedPoint.name ? { name: resolvedPoint.name } : {}),
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
  spots      List known surf spots and aliases

Examples:
  npm run forecast -- --spot steamer-lane --hours 12
  npm run forecast -- --spot pleasure-point --provider open-meteo --hours 12
  npm run forecast -- --lat 36.951 --lng -122.026 --hours 12
  npm run spots
  npm run providers

Options:
  --spot <spot-id-or-alias>
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
