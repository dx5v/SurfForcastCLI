import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  defaultConfigPath,
  loadRuntimeEnv,
  resolveSetupTargetPath,
  shellExportCommand,
  writeEnvValue,
} from "../src/config/env.js";

test("runtime env loader merges user config and local env without overriding process env", () => {
  const dir = mkdtempSync(join(tmpdir(), "surf-forecast-env-"));
  const userConfig = join(dir, "user.env");
  const localConfig = join(dir, "local.env");
  const env: NodeJS.ProcessEnv = {
    XDG_CONFIG_HOME: join(dir, "xdg"),
    EXISTING: "from-process",
  };

  try {
    writeFileSync(
      userConfig,
      [
        "STORMGLASS_API_KEY=user-key",
        "LOCAL_ONLY=user-only",
        "EXISTING=from-user",
      ].join("\n"),
    );
    writeFileSync(
      localConfig,
      [
        "STORMGLASS_API_KEY=local-key",
        "QUOTED=\"hello world\"",
        "EXISTING=from-local",
      ].join("\n"),
    );

    const result = loadRuntimeEnv({
      env,
      paths: [userConfig, localConfig],
    });

    assert.equal(env.STORMGLASS_API_KEY, "local-key");
    assert.equal(env.LOCAL_ONLY, "user-only");
    assert.equal(env.QUOTED, "hello world");
    assert.equal(env.EXISTING, "from-process");
    assert.deepEqual(
      result.files.map((file) => file.loadedKeys),
      [
        ["STORMGLASS_API_KEY", "LOCAL_ONLY", "EXISTING"],
        ["STORMGLASS_API_KEY", "QUOTED", "EXISTING"],
      ],
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("setup target resolver supports user, local, and explicit paths", () => {
  const dir = mkdtempSync(join(tmpdir(), "surf-forecast-target-"));

  try {
    assert.equal(
      resolveSetupTargetPath("user", { env: { XDG_CONFIG_HOME: dir } }),
      defaultConfigPath({ XDG_CONFIG_HOME: dir }),
    );
    assert.equal(resolveSetupTargetPath("local", { cwd: dir }), join(dir, ".env"));
    assert.equal(resolveSetupTargetPath("custom.env", { cwd: dir }), join(dir, "custom.env"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("env writer creates and updates quoted env values", () => {
  const dir = mkdtempSync(join(tmpdir(), "surf-forecast-write-env-"));
  const path = join(dir, "config.env");

  try {
    const created = writeEnvValue(path, "STORMGLASS_API_KEY", "first value");
    assert.equal(created.created, true);
    assert.equal(created.updated, false);
    assert.match(readFileSync(path, "utf8"), /STORMGLASS_API_KEY="first value"/);

    const updated = writeEnvValue(path, "STORMGLASS_API_KEY", "second value");
    assert.equal(updated.created, false);
    assert.equal(updated.updated, true);
    assert.match(readFileSync(path, "utf8"), /STORMGLASS_API_KEY="second value"/);
    assert.equal(
      loadRuntimeEnv({ env: {}, paths: [path] }).files[0]?.loadedKeys[0],
      "STORMGLASS_API_KEY",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("shell export command quotes sensitive values", () => {
  assert.equal(
    shellExportCommand("STORMGLASS_API_KEY", "a'b c"),
    "export STORMGLASS_API_KEY='a'\"'\"'b c'",
  );
});
