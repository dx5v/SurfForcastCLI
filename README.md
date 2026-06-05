# Surf Forecast CLI/MCP

Early spike for a surf forecast data service that can expose provider-backed ocean and wind data to agents through CLI and MCP interfaces.

## Architecture

The service layer is shaped around provider adapters that emit one canonical surf model. Default provider order is Stormglass first, then Open-Meteo fallback. See [docs/architecture.md](docs/architecture.md).

## Provider Probe

Run raw provider requests before building the retrieval layer:

```bash
npm run probe:providers
```

The probe is written in TypeScript. Open-Meteo works without credentials. Stormglass is skipped unless `STORMGLASS_API_KEY` is set in your shell or local `.env` file:

```env
STORMGLASS_API_KEY=...
```

Useful options:

```bash
npm run probe:providers -- --lat 36.951 --lng -122.026 --hours 48 --sample 5
npm run probe:providers -- --provider open-meteo
npm run probe:providers -- --provider stormglass --stormglass-source sg --stormglass-datum MLLW
```

## Forecast CLI

Fetch canonical surf data as JSON:

```bash
npm run forecast -- --lat 36.951 --lng -122.026 --hours 12
```

List provider configuration and capabilities:

```bash
npm run providers
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
- `list_surf_providers`

## Tests

Run typecheck and no-quota mocked provider tests:

```bash
npm run typecheck
npm run test
```
