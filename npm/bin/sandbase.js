#!/usr/bin/env node
"use strict";

const { spawnSync } = require("child_process");
const path = require("path");

const binary = path.join(__dirname, process.platform === "win32" ? "sandbase-bin.exe" : "sandbase-bin");
const result = spawnSync(binary, process.argv.slice(2), { stdio: "inherit" });

if (result.error) {
  console.error(`Failed to run sandbase: ${result.error.message}`);
  console.error("Try reinstalling @sandbaseai/cli.");
  process.exit(1);
}

process.exit(result.status ?? 1);
