import type {
  ProviderAttempt,
  ProviderId,
  ProviderWarning,
  SurfForecast,
  SurfForecastRequest,
} from "../domain/surf.js";
import { createDefaultProviderRegistry, ProviderRegistry } from "../providers/registry.js";
import {
  providerAttemptFromError,
  SurfProviderError,
  type ProviderRuntimeContext,
  type SurfDataProvider,
} from "../providers/types.js";

export type SurfForecastServiceOptions = {
  registry?: ProviderRegistry;
  context?: ProviderRuntimeContext;
};

export class SurfForecastService {
  private readonly registry: ProviderRegistry;
  private readonly context: ProviderRuntimeContext;

  constructor(options: SurfForecastServiceOptions = {}) {
    this.registry = options.registry ?? createDefaultProviderRegistry();
    this.context =
      options.context ??
      {
        env: process.env,
        fetch: globalThis.fetch,
        now: () => new Date(),
      };
  }

  listProviders(): SurfDataProvider[] {
    return this.registry.list();
  }

  getProviderPlan(request: SurfForecastRequest): ProviderId[] {
    return this.registry.resolvePlan(request).map((provider) => provider.id);
  }

  async getForecast(request: SurfForecastRequest): Promise<SurfForecast> {
    const providers = this.registry.resolvePlan(request);
    const attempts: ProviderAttempt[] = [];

    for (const provider of providers) {
      const configStatus = provider.getConfigStatus(this.context.env);

      if (!configStatus.configured) {
        attempts.push({
          providerId: provider.id,
          status: "skipped",
          code: "not_configured",
          message: configStatus.reason,
        });
        continue;
      }

      try {
        const forecast = await provider.fetchForecast(request, this.context);
        const providerAttempts = [
          ...attempts,
          {
            providerId: provider.id,
            status: "succeeded",
          } satisfies ProviderAttempt,
        ];

        return withProviderAttempts(forecast, providerAttempts);
      } catch (error) {
        const attempt = providerAttemptFromError(provider.id, error);
        attempts.push(attempt);

        if (error instanceof SurfProviderError && !error.retryable) {
          break;
        }
      }
    }

    throw new SurfProviderError({
      providerId: "surf-forecast-service",
      code: "no_provider_succeeded",
      retryable: false,
      message: "No surf forecast provider succeeded.",
      details: { attempts },
    });
  }
}

function withProviderAttempts(
  forecast: SurfForecast,
  providerAttempts: ProviderAttempt[],
): SurfForecast {
  const attemptWarnings = providerAttempts
    .filter((attempt) => attempt.status !== "succeeded")
    .map(providerAttemptToWarning);

  return {
    ...forecast,
    warnings: [...attemptWarnings, ...forecast.warnings],
    meta: {
      ...forecast.meta,
      providerAttempts,
    },
  };
}

function providerAttemptToWarning(attempt: ProviderAttempt): ProviderWarning {
  return {
    providerId: attempt.providerId,
    code: attempt.code ?? attempt.status,
    message: attempt.message ?? `Provider ${attempt.providerId} ${attempt.status}.`,
  };
}

