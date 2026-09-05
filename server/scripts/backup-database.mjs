import { mkdirSync, createWriteStream, unlinkSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const databaseUrl = process.env.SUPABASE_DB_URL;
if (!databaseUrl) {
  process.stderr.write("SUPABASE_DB_URL is required. Use the direct database connection string from Supabase.\n");
  process.exit(1);
}

const backupDirectory = resolve(process.env.BACKUP_DIR || "backups");
mkdirSync(backupDirectory, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputPath = resolve(backupDirectory, `studyai-${stamp}.dump`);
const output = createWriteStream(outputPath, { flags: "wx" });
const parsedUrl = new URL(databaseUrl);
const databasePassword = decodeURIComponent(parsedUrl.password);
parsedUrl.password = "";
const child = spawn("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", "--dbname", parsedUrl.toString()], {
  stdio: ["ignore", "pipe", "inherit"],
  env: { ...process.env, PGPASSWORD: databasePassword },
});

child.stdout.pipe(output);
child.on("error", (error) => {
  process.stderr.write(`Could not start pg_dump: ${error.message}\n`);
  process.exitCode = 1;
});
child.on("close", (code) => {
  if (code === 0) process.stdout.write(`${outputPath}\n`);
  else {
    try { unlinkSync(outputPath); } catch {}
    process.stderr.write(`pg_dump exited with code ${code}\n`);
    process.exitCode = code || 1;
  }
});
