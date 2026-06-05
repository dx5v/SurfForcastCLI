import type { ProviderId, SurfForecastRequest } from "../domain/surf.js";
import { createOpenMeteoProvider } from "./open-meteo.js";
import { createStormglassProvider } from "./stormglass.js";
import type { SurfDataProvider } from "./types.js";

export const DEFAULT_PROVIDER_ORDER = ["stormglass", "open-meteo"] as const;

export class ProviderRegistry {
  private readonly providers = new Map<ProviderId, SurfDataProvider>();

  constructor(providers: SurfDataProvider[]) {
    for (const provider of providers) {
      this.providers.set(provider.id, provider);
    }
  }

  list(): SurfDataProvider[] {
    return Array.from(this.providers.values());
  }

  get(providerId: ProviderId): SurfDataProvider | undefined {
    return this.providers.get(providerId);
  }

  resolvePlan(request: SurfForecastRequest): SurfDataProvider[] {
    const providerOrder = this.resolveProviderOrder(request);

    return providerOrder.map((providerId) => {
      const provider = this.get(providerId);

      if (!provider) {
        throw new Error(`Unknown surf data provider: ${providerId}`);
      }

      return provider;
    });
  }

  private resolveProviderOrder(request: SurfForecastRequest): ProviderId[] {
    if (request.provider && request.provider !== "auto") {
      return [request.provider, ...(request.fallbackProviders ?? [])];
    }

    if (request.fallbackProviders?.length) {
      return request.fallbackProviders;
    }

    return [...DEFAULT_PROVIDER_ORDER];
  }
}

export function createDefaultProviderRegistry(): ProviderRegistry {
  return new ProviderRegistry([
    createStormglassProvider(),
    createOpenMeteoProvider(),
  ]);
}

