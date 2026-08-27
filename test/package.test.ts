import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

test("package identity and executable are the formal release contract", async () => {
  const manifest = JSON.parse(await readFile(join(process.cwd(), "package.json"), "utf8")) as {
    name?: string;
    version?: string;
    bin?: Record<string, string>;
  };

  assert.equal(manifest.name, "@sandbaseai/cli");
  assert.match(manifest.version ?? "", /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
  assert.deepEqual(manifest.bin, { sandbase: "dist/cli.js" });
});

test("package declares the native Skill at the standard registry path", async () => {
  const manifest = JSON.parse(await readFile(join(process.cwd(), "package.json"), "utf8")) as { files?: string[] };
  assert.ok(manifest.files?.includes("assets"));
  assert.ok(manifest.files?.includes("skills"));
  const skill = await readFile(join(process.cwd(), "skills", "sandbase", "SKILL.md"), "utf8");
  assert.match(skill, /name: sandbase/);
  assert.match(skill, /sandbase-cli-managed: sandbase/);
  assert.match(skill, /^disable-model-invocation: true$/m);
});

test("MCP Registry metadata exposes the authenticated remote endpoint", async () => {
  const manifest = JSON.parse(await readFile(join(process.cwd(), "server.json"), "utf8")) as {
    name?: string;
    version?: string;
    remotes?: Array<{
      type?: string;
      url?: string;
      headers?: Array<{ name?: string; isRequired?: boolean; isSecret?: boolean }>;
    }>;
  };

  assert.equal(manifest.name, "io.github.sandbaseai/cli");
  assert.equal(manifest.version, "0.1.17");
  assert.deepEqual(manifest.remotes, [
    {
      type: "streamable-http",
      url: "https://sandbase.ai/v1/mcp",
      headers: [
        {
          name: "Authorization",
          description: "Bearer credential issued by the SandBase browser sign-in flow",
          isRequired: true,
          isSecret: true,
        },
      ],
    },
  ]);
});
