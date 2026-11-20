import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

execSync("npx vite build --config vite.android.config.ts", { stdio: "inherit" });

const clientDir = path.resolve("dist/client");
const assetsDir = path.join(clientDir, "assets");
const indexPath = path.join(clientDir, "index.html");

if (!fs.existsSync(assetsDir)) {
  console.error("[android-build] Missing dist/client/assets. Build failed.");
  process.exit(1);
}

const files = fs.readdirSync(assetsDir);
const cssFiles = files.filter((f) => f.endsWith(".css"));
const jsFiles = files.filter((f) => f.endsWith(".js"));

const html = `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <meta name="theme-color" content="#020617" />
    <title>Soulmate · AI Life Simulation</title>
    ${cssFiles.map((f) => `<link rel="stylesheet" href="./assets/${f}" />`).join("\n    ")}
  </head>
  <body class="bg-slate-950 text-slate-100 select-none">
    <div id="root"></div>
    ${jsFiles.map((f) => `<script type="module" src="./assets/${f}"></script>`).join("\n    ")}
  </body>
</html>
`;

fs.writeFileSync(indexPath, html, "utf8");
console.log("[android-build] Built standalone Android web bundle at dist/client/index.html");
