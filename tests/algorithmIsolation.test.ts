import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// SECURITY GUARD: the decision algorithm (scoring, ranking, fairness/no-go
// mechanics, DEFAULT_OPTIONS weights) lives ONLY in the `decision` Edge Function
// under supabase/functions/decision/. If it is ever imported back into client
// code it would ship in the web/PWA bundle and be readable by anyone. This test
// scans the client source (app/ and src/) and fails if that happens.

const CLIENT_ROOTS = ["app", "src"];

// Forbidden import module paths (the algorithm now lives server-side only).
const FORBIDDEN_IMPORT = /from\s+['"][^'"]*(fairConstellationSelection|functions\/decision)[^'"]*['"]/;
// The core algorithm entry point — must never be referenced from the client.
const FORBIDDEN_IDENTIFIER = /\bselectFairConstellation\b/;

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

describe("algorithm isolation", () => {
  const root = process.cwd();
  const files = CLIENT_ROOTS.flatMap((relativeRoot) => collectSourceFiles(join(root, relativeRoot)));

  it("scans a non-trivial number of client files", () => {
    // Sanity check so a broken path can't make the guard silently pass.
    expect(files.length).toBeGreaterThan(20);
  });

  it("no client file imports the decision algorithm", () => {
    const offenders = files.filter((file) => FORBIDDEN_IMPORT.test(readFileSync(file, "utf8")));
    expect(offenders, `These client files import the server-only decision algorithm:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("no client file references selectFairConstellation", () => {
    const offenders = files.filter((file) => FORBIDDEN_IDENTIFIER.test(readFileSync(file, "utf8")));
    expect(offenders, `These client files reference the server-only algorithm entry point:\n${offenders.join("\n")}`).toEqual([]);
  });
});
