import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";

const port = Number(process.env.PORT ?? 3001);
const hostname = "127.0.0.1";
const app = next({ dev: true, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

createServer((req, res) => {
  handle(req, res, parse(req.url ?? "/", true));
}).listen(port, hostname, () => {
  console.log(`Ready on http://${hostname}:${port}`);
});
