// SECURITY GUARD (build-time): fails the web/PWA build if the decision algorithm
// leaked into the exported bundle. The algorithm must run only in the `decision`
// Edge Function — never in client code. These sentinels are property keys and the
// entry-point name from supabase/functions/decision/_shared/algorithm.ts; they
// survive minification (object keys are preserved) but appear nowhere in the
// frontend source, so finding any of them in dist/ means the algorithm got bundled.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIST_DIR = join(process.cwd(), "dist");
const SENTINELS = [
  "selectFairConstellation",
  "maybeParticipationWeight",
  "neglectBoostPerWeek",
  "singleGoingNoGoHardBlockThreshold",
  "majorityProtectionVoteShare",
];

if (!existsSync(DIST_DIR)) {
  console.error(`check-web-bundle: dist/ not found at ${DIST_DIR}. Run the web export first.`);
  process.exit(1);
}

function collectFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectFiles(full));
    } else if (/\.(js|mjs|cjs|map)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

const files = collectFiles(DIST_DIR);
const hits = [];

for (const file of files) {
  const content = readFileSync(file, "utf8");
  for (const sentinel of SENTINELS) {
    if (content.includes(sentinel)) {
      hits.push({ file, sentinel });
    }
  }
}

if (hits.length > 0) {
  console.error("check-web-bundle: FAILED — decision algorithm internals found in the web bundle:");
  for (const hit of hits) {
    console.error(`  ${hit.sentinel}  ->  ${hit.file}`);
  }
  console.error("\nThe algorithm must stay server-side (supabase/functions/decision/). Do not import it into client code.");
  process.exit(1);
}

console.log(`check-web-bundle: OK — scanned ${files.length} bundle files, no algorithm internals found.`);
