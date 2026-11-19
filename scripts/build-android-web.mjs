import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

try {
  execSync("npx vite build --mode android", { stdio: "inherit" });
} catch {
  console.log("[android-build] Prerender post-hook skipped; checking dist/client output...");
}

const clientDir = path.resolve("dist/client");
const assetsDir = path.join(clientDir, "assets");
const indexPath = path.join(clientDir, "index.html");

if (!fs.existsSync(assetsDir)) {
  console.error("[android-build] Missing dist/client/assets. Client build failed.");
  process.exit(1);
}

const files = fs.readdirSync(assetsDir);
const cssFiles = files.filter((f) => f.endsWith(".css"));
const jsFiles = files.filter((f) => f.endsWith(".js"));

const html = `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>Soulmate</title>
    ${cssFiles.map((f) => `<link rel="stylesheet" href="/assets/${f}" />`).join("\n    ")}
  </head>
  <body>
    <div id="root"></div>
    ${jsFiles.map((f) => `<script type="module" src="/assets/${f}"></script>`).join("\n    ")}
  </body>
</html>
`;

fs.writeFileSync(indexPath, html, "utf8");
console.log("[android-build] Ready at dist/client/index.html");
