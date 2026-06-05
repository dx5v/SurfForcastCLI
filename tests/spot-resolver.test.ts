import assert from "node:assert/strict";
import test from "node:test";
import {
  listSurfSpots,
  resolveForecastPoint,
  resolveSurfSpot,
} from "../src/index.js";

test("spot catalog resolves ids and aliases", () => {
  assert.ok(listSurfSpots().length >= 1);
  assert.equal(resolveSurfSpot("steamer-lane")?.name, "Steamer Lane");
  assert.equal(resolveSurfSpot("The Lane")?.id, "steamer-lane");
  assert.equal(resolveSurfSpot("pleasure point")?.id, "pleasure-point");
});

test("forecast point resolver prefers spot over coordinates", () => {
  const resolved = resolveForecastPoint({
    spot: "pleasure",
    lat: 1,
    lng: 2,
  });

  assert.equal(resolved.name, "Pleasure Point");
  assert.equal(resolved.point.lat, 36.958);
  assert.equal(resolved.spot?.id, "pleasure-point");
});

test("forecast point resolver accepts raw coordinates when no spot is provided", () => {
  const resolved = resolveForecastPoint({
    lat: 36.951,
    lng: -122.026,
    name: "Custom Break",
  });

  assert.deepEqual(resolved.point, { lat: 36.951, lng: -122.026 });
  assert.equal(resolved.name, "Custom Break");
});

test("forecast point resolver requires a spot or both coordinates", () => {
  assert.throws(
    () => resolveForecastPoint({ lat: 36.951 }),
    /Provide either a known spot or both lat and lng/,
  );
  assert.throws(
    () => resolveForecastPoint({ spot: "not-a-spot" }),
    /Unknown surf spot/,
  );
});

