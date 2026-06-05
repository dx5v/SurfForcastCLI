#!/usr/bin/env node

import { stdin, stdout } from "node:process";
import {
  resolveSetupTargetPath,
  shellExportCommand,
  writeEnvValue,
} from "./config/env.js";
import {
  loadRuntimeEnv,
  listSurfRegions,
  listSurfSpots,
  listSurfSpotsByRegion,
  resolveForecastPoint,
  SurfForecastService,
  SurfProviderError,
  type ProviderId,
  type SurfDataField,
  type SurfForecastRequest,
} from "./index.js";
import { STORMGLASS_API_KEY_ENV } from "./providers/stormglass.js";

type CliArgs = Record<string, string>;

const command = process.argv[2] ?? "forecast";
const args = parseArgs(process.argv.slice(3));
loadRuntimeEnv();
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
    case "regions":
      printRegions();
      break;
    case "setup":
      await runSetup(args);
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
  const region = stringArg(args, "region", undefined);
  writeJson({
    ...(region ? { region } : {}),
    spots: region ? listSurfSpotsByRegion(region) : listSurfSpots(),
  });
}

function printRegions(): void {
  writeJson({ regions: listSurfRegions() });
}

async function runSetup(args: CliArgs): Promise<void> {
  const apiKey =
    stringArg(args, "stormglass-api-key", undefined) ??
    stringArg(args, "key", undefined);
  const target = stringArg(args, "target", "user");
  const printExport = booleanArg(args, "print-export", false);
  const resolvedApiKey =
    apiKey ??
    (stdin.isTTY && stdout.isTTY
      ? await promptHidden("Stormglass API key: ")
      : undefined);

  if (!resolvedApiKey) {
    throw new Error(
      `Missing Stormglass API key. Set ${STORMGLASS_API_KEY_ENV}, pass --stormglass-api-key <key>, or run setup interactively.`,
    );
  }

  if (printExport) {
    writeJson({
      setup: {
        envVar: STORMGLASS_API_KEY_ENV,
        command: shellExportCommand(STORMGLASS_API_KEY_ENV, resolvedApiKey),
        persisted: false,
      },
    });
    return;
  }

  const path = resolveSetupTargetPath(target);
  const result = writeEnvValue(path, STORMGLASS_API_KEY_ENV, resolvedApiKey);
  process.env[STORMGLASS_API_KEY_ENV] = resolvedApiKey;

  writeJson({
    setup: {
      provider: "stormglass",
      envVar: STORMGLASS_API_KEY_ENV,
      target,
      path: result.path,
      created: result.created,
      updated: result.updated,
      configured: true,
    },
  });
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
  regions    List known surf regions
  setup      Configure a Stormglass API key for CLI and MCP use

Examples:
  npm run forecast -- --spot steamer-lane --hours 12
  npm run forecast -- --spot pleasure-point --provider open-meteo --hours 12
  npm run forecast -- --lat 36.951 --lng -122.026 --hours 12
  npm run spots
  npm run spots -- --region north-cal
  npm run regions
  npm run providers
  surf-forecast setup
  surf-forecast setup --target local

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
  --stormglass-api-key <key>
  --target <user|local|path>
  --print-export
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
            hint: errorHint(error),
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

function errorHint(error: SurfProviderError): string | undefined {
  if (
    error.code === "no_provider_succeeded" &&
    JSON.stringify(error.details).includes(STORMGLASS_API_KEY_ENV)
  ) {
    return `Set ${STORMGLASS_API_KEY_ENV}, run surf-forecast setup, or choose --provider open-meteo.`;
  }

  return undefined;
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

function booleanArg(args: CliArgs, key: string, fallback: boolean): boolean {
  const raw = args[key];

  if (raw === undefined) {
    return fallback;
  }

  return raw === "true" || raw === "1" || raw === "yes";
}

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function promptHidden(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const wasRaw = stdin.isRaw;
    let value = "";

    function cleanup(): void {
      stdin.off("data", onData);
      stdin.setRawMode(wasRaw);
      stdin.pause();
      stdout.write("\n");
    }

    function onData(chunk: Buffer | string): void {
      for (const char of chunk.toString("utf8")) {
        if (char === "\u0003") {
          cleanup();
          reject(new Error("Setup cancelled."));
          return;
        }

        if (char === "\r" || char === "\n") {
          cleanup();
          resolve(value);
          return;
        }

        if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
          continue;
        }

        if (char >= " ") {
          value += char;
        }
      }
    }

    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}
