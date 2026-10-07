/* Copies the desktop app file into this package as public/app.html.
   Run after the desktop app gets new features, then restart the server:
       node update-app.mjs
   The server serves app.html byte-identical (the shim reference is injected
   at serve time, never written into the file), so desktop and server always
   run the same app. */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "Goal Setting to the Now.html");
const DEST = join(HERE, "public", "app.html");

if (!existsSync(SRC)) {
  console.error("Not found: " + SRC);
  console.error("This script expects the package to sit next to 'Goal Setting to the Now.html'.");
  process.exit(1);
}
if (!existsSync(join(HERE, "public"))) mkdirSync(join(HERE, "public"), { recursive: true });
copyFileSync(SRC, DEST);
console.log("Copied the app into public/app.html. Restart the server to serve it.");
