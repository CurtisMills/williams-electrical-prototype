// Runs a TypeScript script with the app's "@/" alias and a stub for "server-only".
import { createJiti } from "jiti";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jiti = createJiti(import.meta.url, {
  alias: {
    "@/": path.join(root, "src") + "/",
    "server-only": path.join(root, "scripts/server-only-stub.cjs"),
  },
});
await jiti.import(path.resolve(process.argv[2]));
