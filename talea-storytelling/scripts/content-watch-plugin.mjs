import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptsDir, "..");
const compiler = path.join(scriptsDir, "build-content.mjs");
const contentRoot = path.join(appRoot, "content");
const configFiles = new Set([
  path.join(appRoot, "config", "site.yml"),
  path.join(appRoot, "config", "links.yml"),
]);

const isContentInput = (file) =>
  file.startsWith(`${contentRoot}${path.sep}`) || configFiles.has(file);

export function contentWatchPlugin() {
  return {
    name: "talea-content-watch",
    apply: "serve",
    configureServer(server) {
      server.watcher.add([contentRoot, ...configFiles]);

      let timer = null;
      let running = false;
      let pending = false;

      const compile = () => {
        if (running) {
          pending = true;
          return;
        }
        running = true;
        execFile(
          process.execPath,
          [compiler],
          { cwd: appRoot, encoding: "utf8" },
          (error, stdout, stderr) => {
            running = false;
            const output = [stdout, stderr].filter(Boolean).join("\n").trim();
            if (error) {
              const message = output || error.message;
              server.config.logger.error(`[content] ${message}`);
              server.ws.send({
                type: "error",
                err: { message: `Content build failed\n${message}`, stack: "" },
              });
            } else {
              server.config.logger.info(output || "[content] Bundle rebuilt.");
              server.ws.send({ type: "full-reload" });
            }

            if (pending) {
              pending = false;
              compile();
            }
          },
        );
      };

      const schedule = (event, file) => {
        if (!["add", "change", "unlink"].includes(event) || !isContentInput(file)) return;
        clearTimeout(timer);
        timer = setTimeout(compile, 80);
      };

      server.watcher.on("all", schedule);
      server.httpServer?.once("close", () => {
        clearTimeout(timer);
        server.watcher.off("all", schedule);
      });
    },
  };
}
