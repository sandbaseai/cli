import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("malformed TOML with a final comment fails instead of hanging the CLI", () => {
  // GHSA-7w5x-hrqm-74c2: test in a bounded subprocess so a regression cannot
  // pin the test runner's event loop. No client configuration is touched.
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import assert from "node:assert/strict";
    import { parse } from "smol-toml";
    for (const input of ['a=[1 #', 'a={b=1 #']) {
      assert.throws(() => parse(input));
    }
  `], { encoding: "utf8", timeout: 5000 });
  assert.ifError(child.error);
  assert.equal(child.status, 0, child.stderr);
});
