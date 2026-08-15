#!/usr/bin/env bash
set -euo pipefail

package_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
audit_dir="$(mktemp -d "${TMPDIR:-/tmp}/sandbase-cli-pack.XXXXXX")"
trap 'rm -rf "$audit_dir"' EXIT

cd "$package_root"

node <<'NODE'
const manifest = require('./package.json');
if (manifest.name !== '@sandbaseai/cli' || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version ?? '')) {
  throw new Error('package identity must use the @sandbaseai/cli name and a valid SemVer version');
}
if (Object.keys(manifest.bin ?? {}).length !== 1 || manifest.bin?.sandbase !== 'dist/cli.js') {
  throw new Error('package must expose only the sandbase bin at dist/cli.js');
}
for (const hook of ['preinstall', 'install', 'postinstall']) {
  if (manifest.scripts?.[hook]) {
    throw new Error(`forbidden npm lifecycle hook: ${hook}`);
  }
}
if (manifest.publishConfig?.access !== 'public' || manifest.publishConfig?.provenance !== true) {
  throw new Error('publishConfig must require public access and provenance');
}
NODE

pack_json="$(npm_config_cache="$audit_dir/npm-cache" npm pack --json --ignore-scripts --pack-destination "$audit_dir")"
tarball_name="$(node -e 'const input=JSON.parse(process.argv[1]); const manifest=require("./package.json"); const item=input[0]; const filename=`sandbaseai-cli-${manifest.version}.tgz`; if (input.length !== 1 || item.name !== manifest.name || item.version !== manifest.version || item.filename !== filename) process.exit(1); process.stdout.write(item.filename)' "$pack_json")"
tarball="$audit_dir/$tarball_name"

tar -tzf "$tarball" | LC_ALL=C sort > "$audit_dir/files.txt"

while IFS= read -r entry; do
  case "$entry" in
    package/package.json|package/README.md|package/README.ja.md|package/README.zh-CN.md|package/LICENSE|package/assets/mcp-bridge.mjs|package/assets/skills/sandbase/SKILL.md|package/dist/*.js|package/dist/*.d.ts)
      ;;
    *)
      echo "Unexpected file in npm tarball: $entry" >&2
      exit 1
      ;;
  esac
done < "$audit_dir/files.txt"

for required in package/package.json package/README.md package/LICENSE package/assets/mcp-bridge.mjs package/assets/skills/sandbase/SKILL.md package/dist/cli.js; do
  if ! grep -Fxq "$required" "$audit_dir/files.txt"; then
    echo "Required file missing from npm tarball: $required" >&2
    exit 1
  fi
done

if grep -Eiq '(^|/)(\.env($|\.)|test(s)?/|coverage/|src/|node_modules/)|\.(pem|key|p12|pfx|map)$' "$audit_dir/files.txt"; then
  echo "Forbidden path found in npm tarball" >&2
  exit 1
fi

mkdir "$audit_dir/unpacked"
tar -xzf "$tarball" -C "$audit_dir/unpacked"
if grep -ERIl --binary-files=without-match \
  -e '-----BEGIN .*PRIVATE KEY-----' \
  -e 'npm_[A-Za-z0-9]\{20,\}' \
  -e 'gh[pousr]_[A-Za-z0-9]\{20,\}' \
  -e 'AKIA[0-9A-Z]\{16\}' \
  "$audit_dir/unpacked/package" > "$audit_dir/suspect-files.txt"; then
  echo "Credential-like content found in npm tarball:" >&2
  sed 's#^.*/package/#package/#' "$audit_dir/suspect-files.txt" >&2
  exit 1
fi

echo "npm package audit passed ($tarball_name)"
