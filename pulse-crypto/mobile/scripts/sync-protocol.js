/**
 * Copies the wire contract from the backend into the mobile app.
 *
 * The honest framing: this duplicates a file. The alternative - an npm
 * workspace with a shared `packages/protocol` - is the textbook answer, and it
 * would mean Metro resolver configuration, a build step for the shared package,
 * and a workspace root, all to share roughly 120 lines of types across exactly
 * two consumers. For a two-day exercise that tooling costs more than the
 * duplication it removes.
 *
 * What makes the duplication safe rather than sloppy is that it is mechanical
 * and checkable: the copy carries a generated header, and `--check` fails if it
 * has drifted, so CI or `npm run verify` can catch a backend change that was
 * not propagated.
 *
 *   node scripts/sync-protocol.js           # write the copy
 *   node scripts/sync-protocol.js --check   # exit 1 if out of date
 */

const fs = require("node:fs");
const path = require("node:path");

const SOURCE = path.resolve(__dirname, "../../backend/src/types/protocol.ts");
const TARGET = path.resolve(__dirname, "../src/types/protocol.ts");

const HEADER = `/**
 * GENERATED FILE - DO NOT EDIT.
 *
 * Copied from backend/src/types/protocol.ts by \`npm run sync:protocol\`.
 * Edit the backend copy and re-run the script; edits here will be overwritten.
 */

`;

const main = () => {
  if (!fs.existsSync(SOURCE)) {
    console.error(`[sync:protocol] source not found: ${SOURCE}`);
    process.exit(1);
  }

  const expected = HEADER + fs.readFileSync(SOURCE, "utf8");
  const checkOnly = process.argv.includes("--check");

  if (checkOnly) {
    const actual = fs.existsSync(TARGET) ? fs.readFileSync(TARGET, "utf8") : "";
    if (actual !== expected) {
      console.error(
        "[sync:protocol] mobile/src/types/protocol.ts is out of date. " +
          "Run `npm run sync:protocol`.",
      );
      process.exit(1);
    }
    console.log("[sync:protocol] up to date");
    return;
  }

  fs.mkdirSync(path.dirname(TARGET), { recursive: true });
  fs.writeFileSync(TARGET, expected);
  console.log(`[sync:protocol] wrote ${path.relative(process.cwd(), TARGET)}`);
};

main();
