import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { URL } from "node:url";
import { analyzeCommand } from "../commands/analyze.js";
import { parseApex } from "../parser/apexParser.js";
import { parseFlows } from "../parser/flowParser.js";
import { parseLwc } from "../parser/lwcParser.js";
import { filterNodesByPackage } from "../parser/packageXmlScope.js";
import { MetadataType } from "../types/models.js";

interface UiOptions {
  repo: string;
  packagePath?: string;
  targetOrg?: string;
  port: number;
}

function htmlPage(): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>CRE Scanner UI</title>
  <style>
    body { font-family: Inter, system-ui, sans-serif; margin: 0; background: #0f172a; color: #e2e8f0; }
    .container { max-width: 1100px; margin: 0 auto; padding: 20px; }
    .card { background: #111827; border: 1px solid #334155; border-radius: 10px; padding: 14px; margin-bottom: 12px; }
    label { display: block; margin-bottom: 6px; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
    input, select, button { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #334155; background: #020617; color: #e2e8f0; }
    button { cursor: pointer; background: #1d4ed8; border: none; font-weight: 600; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
    iframe { width: 100%; height: 720px; border: 1px solid #334155; border-radius: 10px; background: #fff; }
    .row { display: flex; gap: 12px; align-items: center; }
    .small { color: #94a3b8; font-size: 12px; }
    .scroll { max-height: 220px; overflow: auto; border: 1px solid #334155; border-radius: 8px; padding: 8px; }
  </style>
</head>
<body>
  <main class="container">
    <h1>Config Reverse Engineer UI</h1>
    <p class="small">Choose component scope and run scanner directly from browser.</p>
    <section class="card">
      <div class="grid">
        <div>
          <label>Repo Path</label>
          <input id="repo" />
        </div>
        <div>
          <label>Package.xml Path</label>
          <input id="pkg" />
        </div>
        <div>
          <label>Target Org Alias</label>
          <input id="org" />
        </div>
      </div>
    </section>

    <section class="card">
      <div class="grid">
        <div>
          <label>Component Types</label>
          <div class="row">
            <label><input type="checkbox" class="type" value="ApexClass" checked /> ApexClass</label>
            <label><input type="checkbox" class="type" value="LightningComponentBundle" checked /> LWC</label>
            <label><input type="checkbox" class="type" value="Flow" checked /> Flow</label>
          </div>
        </div>
        <div>
          <label>Component Names (optional)</label>
          <div id="components" class="scroll"></div>
        </div>
      </div>
      <div style="margin-top:10px">
        <button id="load">Load Components</button>
      </div>
    </section>

    <section class="card">
      <div class="grid">
        <div><label>Output Format</label><select id="format"><option value="html">html</option><option value="json">json</option><option value="md">md</option></select></div>
        <div><label>Mode</label><select id="mode"><option value="local">local</option><option value="ci">ci</option><option value="governance">governance</option></select></div>
        <div><label>Team</label><input id="team" value="Architecture" /></div>
        <div><label>Release Train</label><input id="release" value="R1" /></div>
      </div>
      <div style="margin-top:12px"><button id="run">Run Scanner</button></div>
      <p id="status" class="small"></p>
    </section>

    <section class="card">
      <h3>Report Preview</h3>
      <iframe id="reportFrame"></iframe>
    </section>
  </main>
  <script>
    const repoInput = document.getElementById("repo");
    const pkgInput = document.getElementById("pkg");
    const orgInput = document.getElementById("org");
    const componentContainer = document.getElementById("components");
    const status = document.getElementById("status");
    const frame = document.getElementById("reportFrame");

    async function loadComponents() {
      status.textContent = "Loading components...";
      const res = await fetch("/api/components", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ repo: repoInput.value, packagePath: pkgInput.value })
      });
      const data = await res.json();
      if (!res.ok) { status.textContent = data.error || "Failed loading components"; return; }
      componentContainer.innerHTML = data.components.map(c =>
        '<label><input type="checkbox" class="component" value="'+c.name+'" /> '+c.type+' :: '+c.name+'</label>'
      ).join("");
      status.textContent = "Components loaded.";
    }

    async function runScan() {
      status.textContent = "Running scanner...";
      const typeValues = [...document.querySelectorAll(".type:checked")].map(e => e.value);
      const componentValues = [...document.querySelectorAll(".component:checked")].map(e => e.value);
      const payload = {
        repo: repoInput.value,
        packagePath: pkgInput.value || undefined,
        targetOrg: orgInput.value || undefined,
        format: document.getElementById("format").value,
        mode: document.getElementById("mode").value,
        team: document.getElementById("team").value,
        releaseTrain: document.getElementById("release").value,
        componentTypes: typeValues,
        components: componentValues
      };
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) { status.textContent = data.error || "Scan failed"; return; }
      status.textContent = "Done. " + data.message;
      if (data.reportPath.endsWith(".html")) {
        frame.src = "/api/report?path=" + encodeURIComponent(data.reportPath);
      } else {
        frame.srcdoc = "<pre style='white-space:pre-wrap;padding:10px'>" + JSON.stringify(data.result, null, 2) + "</pre>";
      }
    }

    document.getElementById("load").addEventListener("click", loadComponents);
    document.getElementById("run").addEventListener("click", runScan);
  </script>
</body>
</html>`;
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function sendJson(res: http.ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function collectComponents(repo: string, packagePath?: string): Array<{ name: string; type: MetadataType }> {
  const nodes = filterNodesByPackage([...parseApex(repo), ...parseLwc(repo), ...parseFlows(repo)], packagePath);
  const seen = new Set<string>();
  const components: Array<{ name: string; type: MetadataType }> = [];
  for (const node of nodes) {
    const key = `${node.type}:${node.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    components.push({ name: node.name, type: node.type });
  }
  return components.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
}

export function startUiServer(opts: UiOptions): void {
  const server = http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url ?? "/", `http://${req.headers.host}`);

    if (req.method === "GET" && reqUrl.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(htmlPage());
      return;
    }

    if (req.method === "POST" && reqUrl.pathname === "/api/components") {
      try {
        const body = JSON.parse(await readBody(req)) as { repo?: string; packagePath?: string };
        const repo = body.repo ?? opts.repo;
        const packagePath = body.packagePath ?? opts.packagePath;
        const components = collectComponents(path.resolve(repo), packagePath ? path.resolve(packagePath) : undefined);
        sendJson(res, 200, { components });
      } catch (error) {
        sendJson(res, 500, { error: `${error}` });
      }
      return;
    }

    if (req.method === "POST" && reqUrl.pathname === "/api/analyze") {
      try {
        const body = JSON.parse(await readBody(req)) as Record<string, unknown>;
        const repo = path.resolve(`${body.repo ?? opts.repo}`);
        const format = `${body.format ?? "html"}`;
        const reportPath = path.resolve(repo, `ui-cre-report.${format === "md" ? "md" : format}`);
        await analyzeCommand({
          repo,
          packagePath: body.packagePath ? path.resolve(`${body.packagePath}`) : opts.packagePath,
          targetOrg: `${body.targetOrg ?? opts.targetOrg ?? ""}` || undefined,
          format: format as "json" | "md" | "html",
          mode: `${body.mode ?? "local"}` as "local" | "ci" | "governance",
          out: reportPath,
          team: `${body.team ?? "Architecture"}`,
          releaseTrain: `${body.releaseTrain ?? "R1"}`,
          componentTypes: Array.isArray(body.componentTypes)
            ? (body.componentTypes.filter(Boolean) as MetadataType[])
            : undefined,
          components: Array.isArray(body.components) ? body.components.map((c) => `${c}`) : undefined,
        });
        let result: unknown = null;
        if (format !== "html" && fs.existsSync(reportPath)) {
          result = JSON.parse(fs.readFileSync(reportPath, "utf8"));
        }
        sendJson(res, 200, { message: "Analysis complete", reportPath, result });
      } catch (error) {
        sendJson(res, 500, { error: `${error}` });
      }
      return;
    }

    if (req.method === "GET" && reqUrl.pathname === "/api/report") {
      const reportPath = reqUrl.searchParams.get("path");
      if (!reportPath || !fs.existsSync(reportPath)) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Report not found");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(fs.readFileSync(reportPath, "utf8"));
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  });

  server.listen(opts.port, "127.0.0.1", () => {
    console.log(`CRE UI available at http://127.0.0.1:${opts.port}`);
  });
}
