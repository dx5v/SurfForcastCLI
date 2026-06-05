# Surf Forecast Architecture

This project exposes surf forecast data to agents through CLI and MCP surfaces. Both surfaces should call the same service layer and receive the same canonical surf model.

## Provider Policy

Default provider order:

1. Stormglass
2. Open-Meteo

Stormglass is preferred because one weather request can return wave, swell, wind, current, and water-temperature fields, and its tide endpoints return extremes with station metadata. Open-Meteo is the fallback because it is credential-free and reliable, but it requires joining separate marine and weather responses.

Explicit provider requests should use only that provider unless the caller supplies fallback providers.

## Runtime Shape

```text
Agent via MCP              Agent via shell/CLI
     |                          |
     v                          v
  MCP tools              JSON-first CLI commands
     \                          /
      v                        v
            SurfForecastService
                    |
             ProviderRegistry
                    |
        --------------------------
        |                        |
 StormglassProvider       OpenMeteoProvider
        |                        |
   native response          native responses
   source-wrapped           marine + weather
        \                        /
         v                      v
             Canonical Surf Model
```

## Provider Adapter Responsibilities

Each provider adapter owns provider-specific details:

- Native request URLs and authentication
- Field name mapping
- Unit normalization into canonical units
- Hourly time alignment
- Provider warnings and provenance
- Partial-data handling

Adapters should not decide whether conditions are good. Analysis and scoring belong above the provider layer.

## Observed Provider Shapes

Stormglass weather values are source-wrapped:

```json
{
  "time": "2026-06-05T01:00:00+00:00",
  "waveHeight": { "sg": 2.65 },
  "swellHeight": { "sg": 2.41 },
  "windSpeed": { "sg": 1.51 }
}
```

Stormglass tides are separate endpoint results with station metadata:

```json
{
  "data": [
    {
      "height": 0.265,
      "time": "2026-06-05T01:41:00+00:00",
      "type": "high"
    }
  ],
  "meta": {
    "datum": "MLLW",
    "station": {
      "distance": 21,
      "source": "ticon4"
    }
  }
}
```

Open-Meteo returns arrays by field. Marine and weather are separate products:

```json
{
  "hourly": {
    "time": ["2026-06-04T00:00"],
    "wave_height": [1.52],
    "swell_wave_height": [1.2]
  }
}
```

```json
{
  "hourly": {
    "time": ["2026-06-04T00:00"],
    "wind_speed_10m": [3.41],
    "wind_direction_10m": [273]
  }
}
```

## Canonical Model

The canonical model uses stable internal units:

- Heights: meters
- Periods: seconds
- Wind/current speeds: meters per second
- Temperature: Celsius
- Directions: degrees
- Times: ISO strings with explicit timezone or UTC offset

CLI and MCP callers can request display conversions later, but provider adapters should emit canonical units only.

## Next Build Steps

1. Move raw Stormglass request logic from `scripts/probe-providers.ts` into `StormglassProvider`.
2. Normalize Stormglass source-wrapped values into canonical hourly readings.
3. Move Open-Meteo marine/weather joins into `OpenMeteoProvider`.
4. Add fixture-based provider conformance tests.
5. Add MCP and CLI surfaces over `SurfForecastService`.

