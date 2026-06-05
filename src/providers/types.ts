import type {
  ProviderAttempt,
  ProviderId,
  SurfDataField,
  SurfForecast,
  SurfForecastRequest,
  SwellComponent,
} from "../domain/surf.js";

export type TideCapability = "none" | "sea-level" | "extremes" | "both";

export type ProviderCapabilities = {
  forecast: boolean;
  fields: SurfDataField[];
  swellComponents: SwellComponent[];
  tides: TideCapability;
  currents: boolean;
  waterTemperature: boolean;
  nativeSources: boolean;
  requiresApiKey: boolean;
  notes?: string[];
};

export type ProviderConfigStatus =
  | { configured: true }
  | {
      configured: false;
      reason: string;
      missingEnvVars?: string[];
    };

export type ProviderRuntimeContext = {
  env: NodeJS.ProcessEnv;
  fetch: typeof globalThis.fetch;
  now: () => Date;
};

export type SurfDataProvider = {
  id: ProviderId;
  displayName: string;
  capabilities: ProviderCapabilities;
  getConfigStatus(env: NodeJS.ProcessEnv): ProviderConfigStatus;
  fetchForecast(
    request: SurfForecastRequest,
    context: ProviderRuntimeContext,
  ): Promise<SurfForecast>;
};

export type SurfProviderErrorCode =
  | "not_configured"
  | "not_implemented"
  | "request_failed"
  | "invalid_response"
  | "no_provider_succeeded";

export class SurfProviderError extends Error {
  readonly providerId: ProviderId;
  readonly code: SurfProviderErrorCode;
  readonly retryable: boolean;
  readonly details?: unknown;

  constructor(input: {
    providerId: ProviderId;
    code: SurfProviderErrorCode;
    message: string;
    retryable: boolean;
    details?: unknown;
  }) {
    super(input.message);
    this.name = "SurfProviderError";
    this.providerId = input.providerId;
    this.code = input.code;
    this.retryable = input.retryable;

    if ("details" in input) {
      this.details = input.details;
    }
  }
}

export function providerAttemptFromError(
  providerId: ProviderId,
  error: unknown,
): ProviderAttempt {
  if (error instanceof SurfProviderError) {
    return {
      providerId,
      status: "failed",
      code: error.code,
      message: error.message,
    };
  }

  return {
    providerId,
    status: "failed",
    code: "request_failed",
    message: error instanceof Error ? error.message : "Unknown provider error.",
  };
}

