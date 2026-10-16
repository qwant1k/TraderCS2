import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const env = await readFile(resolve(root, ".env"), "utf8").catch(() => "");
const raw = env.match(/^APP_URL=(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, "") || "http://localhost:3000";
const app = new URL(raw);
if (!/^https?:$/.test(app.protocol)) throw new Error("APP_URL должен использовать http или https");

const path = resolve(root, "extension", "manifest.json");
const manifest = JSON.parse(await readFile(path, "utf8"));
manifest.content_scripts[1].matches = [`${app.origin}/*`];
await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Extension origin: ${app.origin}`);
