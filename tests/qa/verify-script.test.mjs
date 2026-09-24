// tests/qa/verify-script.test.mjs
//
// `pnpm verify` is the single gate a change must pass before it is
// considered done. It exists because the three checks it composes are
// each individually insufficient:
//
//   - `pnpm typecheck` covers **/*.ts but runs no tests.
//   - `bun test src/` covers the new dependency-free modules but is
//     invisible to the Node-based suite.
//   - `pnpm test` builds and runs tests/qa/* but does not typecheck.
//
// A real defect has already slipped through that gap: the JSX runtime's
// props typing was verified with tsc against the runtime file alone,
// passed, and still failed the project-wide typecheck that includes its
// test file. This test pins the composition so the gate cannot silently
// lose one of its three legs.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

test("package.json exposes a single `verify` gate", () => {
  assert.ok(
    typeof pkg.scripts?.verify === "string",
    "expected a `verify` script in package.json",
  );
});

test("`verify` composes typecheck, the Bun suite, and the Node suite", () => {
  const verify = pkg.scripts.verify;

  for (const leg of ["typecheck", "bun test src/", "test"]) {
    assert.ok(
      verify.includes(leg),
      `expected \`verify\` to run ${leg}, got: ${verify}`,
    );
  }
});

test("`verify` chains its legs so any failure stops the run", () => {
  const verify = pkg.scripts.verify;

  assert.ok(
    !verify.includes(";") && !verify.includes("||"),
    `expected && chaining so a failing leg fails the gate, got: ${verify}`,
  );
  assert.equal(
    verify.split("&&").length,
    3,
    `expected exactly three chained legs, got: ${verify}`,
  );
});
