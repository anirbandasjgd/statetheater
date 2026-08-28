import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export function applyDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    const mount = process.env.RAILWAY_VOLUME_MOUNT_PATH?.replace(/\/$/, "");
    process.env.DATABASE_URL = mount ? `file:${mount}/prod.db` : "file:./dev.db";
  }
  return process.env.DATABASE_URL;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  applyDatabaseUrl();
  const args = process.argv.slice(2);
  if (args.length > 0) {
    const result = spawnSync(args[0], args.slice(1), {
      stdio: "inherit",
      env: process.env,
      shell: true,
    });
    process.exit(result.status ?? 1);
  }
}
