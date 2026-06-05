# Surf Forecast CLI/MCP

A surf forecast data service that exposes provider-backed ocean and wind data to agents through CLI and MCP interfaces.

## Architecture

The service layer is shaped around provider adapters that emit one canonical surf model. Default provider order is Stormglass first, then Open-Meteo fallback. See [docs/architecture.md](docs/architecture.md).

Stormglass is the default provider. Set `STORMGLASS_API_KEY` in your shell or local `.env` file:

```env
STORMGLASS_API_KEY=...
```

## Package

Build the distributable package:

```bash
npm run build
```

Preview the files that would be published:

```bash
npm run pack:dry
```

After publishing, install and run:

```bash
npm install -g surf-forecast-cli-mcp
surf-forecast providers
surf-forecast spots --region santa-cruz
surf-forecast-mcp
```

Use the library API from TypeScript or ESM JavaScript:

```ts
import { SurfForecastService, resolveForecastPoint } from "surf-forecast-cli-mcp";

const service = new SurfForecastService();
const point = resolveForecastPoint({ spot: "pleasure-point" });
const forecast = await service.getForecast({
  point: point.point,
  name: point.name,
  hours: 12,
});
```

## Forecast CLI

Fetch canonical surf data as JSON. Prefer `--spot` for known breaks; use `--lat` and `--lng` for custom points:

```bash
npm run forecast -- --spot steamer-lane --hours 12
npm run forecast -- --spot pleasure-point --provider open-meteo --hours 12
npm run forecast -- --lat 36.951 --lng -122.026 --hours 12
```

List provider configuration and capabilities:

```bash
npm run providers
```

List known spot ids and aliases, optionally scoped by a region:

```bash
npm run spots
npm run spots -- --region north-cal
npm run spots -- --region san-mateo-coast
```

List known surf regions:

```bash
npm run regions
```

## MCP Server

Start the stdio MCP server:

```bash
npm run mcp
```

Tools:

- `get_surf_forecast`
- `get_wave_forecast`
- `get_wind_forecast`
- `get_tide_forecast`
- `get_ocean_forecast`
- `compare_surf_providers`
- `list_surf_spots`
- `list_surf_regions`
- `resolve_surf_spot`
- `list_surf_providers`

Forecast tools accept either `spot` or both `lat` and `lng`. Discovery tools let agents
avoid raw coordinates by listing regions first, then spots within a region.

## Tests

Run typecheck and no-quota mocked provider tests:

```bash
npm run typecheck
npm run test
```
