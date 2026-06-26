#!/usr/bin/env node
"use strict";

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const https = require("https");
const os = require("os");

const REPO = "sandbaseai/cli";
const BIN_DIR = path.join(__dirname, "bin");
const BIN_PATH = path.join(BIN_DIR, os.platform() === "win32" ? "sandbase.exe" : "sandbase");

function getPlatform() {
  const platform = os.platform();
  switch (platform) {
    case "darwin":
      return "darwin";
    case "linux":
      return "linux";
    case "win32":
      return "windows";
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

function getArch() {
  const arch = os.arch();
  switch (arch) {
    case "x64":
      return "amd64";
    case "arm64":
      return "arm64";
    default:
      throw new Error(`Unsupported architecture: ${arch}`);
  }
}

function getVersion() {
  const pkg = require("./package.json");
  return pkg.version;
}

function getArchiveName(platform, arch, version) {
  const ext = platform === "windows" ? "zip" : "tar.gz";
  return `sandbase_${version}_${platform}_${arch}.${ext}`;
}

function download(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

async function extract(buffer, platform) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sandbase-"));

  if (platform === "windows") {
    // Write zip and extract with tar (available on modern Windows)
    const zipPath = path.join(tmpDir, "sandbase.zip");
    fs.writeFileSync(zipPath, buffer);
    execSync(`tar -xf "${zipPath}" -C "${tmpDir}"`, { stdio: "ignore" });
  } else {
    // Write tar.gz and extract
    const tarPath = path.join(tmpDir, "sandbase.tar.gz");
    fs.writeFileSync(tarPath, buffer);
    execSync(`tar -xzf "${tarPath}" -C "${tmpDir}"`, { stdio: "ignore" });
  }

  const binaryName = platform === "windows" ? "sandbase.exe" : "sandbase";
  const extractedBin = path.join(tmpDir, binaryName);

  if (!fs.existsSync(extractedBin)) {
    throw new Error(`Binary not found after extraction: ${extractedBin}`);
  }

  return extractedBin;
}

async function main() {
  const platform = getPlatform();
  const arch = getArch();
  const version = getVersion();

  if (platform === "windows" && arch === "arm64") {
    throw new Error("Windows arm64 is not supported. Please use x64.");
  }

  const archive = getArchiveName(platform, arch, version);
  const url = `https://github.com/${REPO}/releases/download/v${version}/${archive}`;

  console.log(`Downloading sandbase v${version} for ${platform}/${arch}...`);

  const buffer = await download(url);
  const extractedBin = await extract(buffer, platform);

  // Ensure bin directory exists
  if (!fs.existsSync(BIN_DIR)) {
    fs.mkdirSync(BIN_DIR, { recursive: true });
  }

  // Move binary into place
  fs.copyFileSync(extractedBin, BIN_PATH);
  fs.chmodSync(BIN_PATH, 0o755);

  // Cleanup temp
  fs.rmSync(path.dirname(extractedBin), { recursive: true, force: true });

  console.log(`Installed sandbase v${version} to ${BIN_PATH}`);
}

main().catch((err) => {
  console.error(`Failed to install sandbase: ${err.message}`);
  process.exit(1);
});
