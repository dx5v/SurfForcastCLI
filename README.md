# Surf Forecast CLI/MCP

Early spike for a surf forecast data service that can expose provider-backed ocean and wind data to agents through CLI and MCP interfaces.

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
