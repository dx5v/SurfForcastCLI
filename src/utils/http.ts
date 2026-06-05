import { SurfProviderError, type SurfProviderErrorCode } from "../providers/types.js";
import type { ProviderId } from "../domain/surf.js";

export type JsonFetchFailure = {
  status: number;
  statusText: string;
  body: unknown;
};

export async function fetchJson<T>(
  input: {
    providerId: ProviderId;
    label: string;
    url: URL;
    fetch: typeof globalThis.fetch;
    options?: RequestInit;
    retryable?: boolean;
    errorCode?: SurfProviderErrorCode;
  },
): Promise<T> {
  const response = await input.fetch(input.url, input.options);
  const text = await response.text();
  const body = parseJson(text);

  if (!response.ok) {
    throw new SurfProviderError({
      providerId: input.providerId,
      code: input.errorCode ?? "request_failed",
      retryable: input.retryable ?? true,
      message: `${input.label} request failed with ${response.status} ${response.statusText}.`,
      details: {
        url: redactUrl(input.url),
        response: {
          status: response.status,
          statusText: response.statusText,
          body,
        } satisfies JsonFetchFailure,
      },
    });
  }

  return body as T;
}

export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function redactUrl(url: URL): string {
  const copy = new URL(url);
  copy.searchParams.delete("key");
  copy.searchParams.delete("apikey");
  copy.searchParams.delete("api_key");
  return copy.toString();
}

