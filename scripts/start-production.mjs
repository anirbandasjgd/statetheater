import { spawnSync } from "node:child_process";
import { applyDatabaseUrl } from "./ensure-db-url.mjs";

applyDatabaseUrl();

function run(command) {
  const result = spawnSync(command, {
    stdio: "inherit",
    env: process.env,
    shell: true,
  });
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
}

run("npx prisma db push");
run("npm run db:prices");

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const seatCount = await prisma.seat.count();
await prisma.$disconnect();
if (seatCount === 0) {
  run("npm run db:seed");
  run("npm run db:prices");
}
run("npm run db:kills");
run("npm run db:holds");
run("npm run db:ada");
run("npm run db:prices");

const port = process.env.PORT ?? "3000";
run(`npx next start --hostname 0.0.0.0 --port ${port}`);
