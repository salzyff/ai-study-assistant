import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const directory = resolve("supabase/migrations");
const files = readdirSync(directory).filter((file) => file.endsWith(".sql")).sort();
if (!files.length) throw new Error("No SQL migrations found");
files.forEach((file, index) => {
  const expectedPrefix = String(index + 1).padStart(3, "0") + "_";
  if (!file.startsWith(expectedPrefix)) throw new Error(`Expected migration ${expectedPrefix}..., found ${file}`);
  if (!readFileSync(resolve(directory, file), "utf8").trim()) throw new Error(`${file} is empty`);
});
process.stdout.write(`Verified ${files.length} ordered migrations: ${files.join(", ")}\n`);
