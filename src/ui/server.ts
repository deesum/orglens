import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { URL } from "node:url";
import { analyzeCommand } from "../commands/analyze.js";
import { parseApex } from "../parser/apexParser.js";
import { parseFlows } from "../parser/flowParser.js";
import { parseLwc } from "../parser/lwcParser.js";
import { parseMetadataCatalog } from "../parser/metadataCatalogParser.js";
import { filterNodesByPackage } from "../parser/packageXmlScope.js";
import { MetadataType } from "../types/models.js";
import { detectMetadataRoots } from "../utils/scanRoots.js";

interface UiOptions {
  repo: string;
  packagePath?: string;
  targetOrg?: string;
  port: number;
}

function htmlPage(defaults: UiOptions): string {
  const safeRepo = defaults.repo.replaceAll("\\", "\\\\").replaceAll("`", "");
  const safePkg = (defaults.packagePath ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("`", "");
  const safeOrg = (defaults.targetOrg ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("`", "");
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>OrgLens — Scanner UI</title>
  <style>
    body { font-family: Inter, system-ui, sans-serif; margin: 0; background: #0f172a; color: #e2e8f0; }
    .container { max-width: 1100px; margin: 0 auto; padding: 20px; }
    .card { background: #111827; border: 1px solid #334155; border-radius: 10px; padding: 14px; margin-bottom: 12px; }
    label { display: block; margin-bottom: 6px; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
    .grid > div { min-width: 0; }
    input, select, button { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #334155; background: #020617; color: #e2e8f0; }
    input::placeholder { color: #64748b; }
    button { cursor: pointer; background: #1d4ed8; border: none; font-weight: 600; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px; }
    iframe { width: 100%; height: 720px; border: 1px solid #334155; border-radius: 10px; background: #fff; }
    .row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .small { color: #94a3b8; font-size: 12px; }
    .scroll { max-height: 220px; overflow: auto; border: 1px solid #334155; border-radius: 8px; padding: 8px; }
  </style>
</head>
<body>
  <main class="container">
    <h1>🔍 OrgLens — Scanner UI</h1>
    <p class="small">Run scanner with minimal input. Required: project path only. App auto-detects metadata roots.</p>
    <section class="card">
      <div class="grid">
        <div>
          <label>Project Path (required)</label>
          <input id="repo" />
        </div>
      </div>
      <p class="small">Minimal input: only project path. App auto-discovers metadata roots and components.</p>
    </section>

    <section class="card">
      <div class="grid">
        <div>
          <label>Component Types</label>
          <div class="row">
            <label><input type="checkbox" class="type" value="ApexClass" checked /> ApexClass</label>
            <label><input type="checkbox" class="type" value="ApexTrigger" checked /> ApexTrigger</label>
            <label><input type="checkbox" class="type" value="LightningComponentBundle" checked /> LWC</label>
            <label><input type="checkbox" class="type" value="AuraDefinitionBundle" checked /> Aura</label>
            <label><input type="checkbox" class="type" value="Flow" checked /> Flow</label>
            <label><input type="checkbox" class="type" value="CustomObject" checked /> CustomObject</label>
            <label><input type="checkbox" class="type" value="CustomField" checked /> CustomField</label>
            <label><input type="checkbox" class="type" value="PermissionSet" checked /> PermissionSet</label>
            <label><input type="checkbox" class="type" value="FlexiPage" checked /> FlexiPage</label>
            <label><input type="checkbox" class="type" value="CustomLabel" checked /> CustomLabel</label>
            <label><input type="checkbox" class="type" value="StaticResource" checked /> StaticResource</label>
            <label><input type="checkbox" class="type" value="VisualforcePage" checked /> VisualforcePage</label>
          </div>
          <div class="row" style="margin-top:8px">
            <button id="selectAllTypes" type="button">Select All Types</button>
            <button id="clearAllTypes" type="button">Clear Types</button>
          </div>
        </div>
        <div>
          <label>Component Names (optional, overrides broad scans)</label>
          <input id="componentSearch" placeholder="Filter components..." />
          <div class="row" style="margin-top:8px">
            <button id="selectAllComponents" type="button">Select All Visible</button>
            <button id="clearAllComponents" type="button">Clear Selected</button>
          </div>
          <p id="componentStats" class="small"></p>
          <div id="components" class="scroll"></div>
          <p class="small" style="margin-top:6px">Selected components:</p>
          <div id="selectedComponents" class="scroll" style="max-height:120px"></div>
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
        <div><label>CI Threshold (mode=ci)</label><input id="threshold" value="70" /></div>
        <div><label>Provider (optional)</label><select id="provider"><option value="">default</option><option value="openai">openai</option><option value="anthropic">anthropic</option></select></div>
      </div>
      <details style="margin-top:12px">
        <summary>Advanced options</summary>
        <div class="grid" style="margin-top:10px">
          <div><label>Package.xml Path (optional)</label><input id="pkg" /></div>
          <div><label>Target Org Alias (optional)</label><input id="org" /></div>
          <div><label>Team</label><input id="team" value="Architecture" /></div>
          <div><label>Release Train</label><input id="release" value="R1" /></div>
          <div><label>Backlog CSV Output Path (optional)</label><input id="backlogOut" /></div>
        </div>
      </details>
      <div style="margin-top:12px"><button id="run">Run Scanner</button></div>
      <p id="status" class="small"></p>
      <div class="small">
        Modes available:
        <ul>
          <li><strong>local</strong>: one-off architecture analysis</li>
          <li><strong>ci</strong>: fail/warn using threshold gate</li>
          <li><strong>governance</strong>: write trend snapshots for ongoing tracking</li>
        </ul>
      </div>
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
    const componentSearch = document.getElementById("componentSearch");
    const componentStats = document.getElementById("componentStats");
    const selectedComponents = document.getElementById("selectedComponents");
    const status = document.getElementById("status");
    const frame = document.getElementById("reportFrame");
    const modeSelect = document.getElementById("mode");
    const thresholdInput = document.getElementById("threshold");

    repoInput.value = ${JSON.stringify(safeRepo)};
    pkgInput.value = ${JSON.stringify(safePkg)};
    orgInput.value = ${JSON.stringify(safeOrg)};

    let loadedComponents = [];
    function updateComponentStats() {
      const all = loadedComponents.length;
      const visible = [...componentContainer.querySelectorAll("label")].filter(el => el.style.display !== "none").length;
      const selected = [...document.querySelectorAll(".component:checked")].length;
      componentStats.textContent = "Loaded: " + all + " | Visible: " + visible + " | Selected: " + selected;
      const selectedNames = [...document.querySelectorAll(".component:checked")]
        .map((el) => el.value)
        .sort((a, b) => a.localeCompare(b));
      selectedComponents.innerHTML = selectedNames.length
        ? selectedNames.map((name) => '<div>'+name+'</div>').join("")
        : '<div class="small">No components selected (broad scan by selected types).</div>';
    }

    function applyComponentFilter() {
      const q = (componentSearch.value || "").toLowerCase().trim();
      const typeChecked = new Set([...document.querySelectorAll(".type:checked")].map(e => e.value));
      componentContainer.querySelectorAll("label").forEach((labelEl) => {
        const text = labelEl.textContent.toLowerCase();
        const type = labelEl.getAttribute("data-type");
        const show = (!q || text.includes(q)) && typeChecked.has(type);
        labelEl.style.display = show ? "" : "none";
      });
      updateComponentStats();
    }

    function syncComponentSelectionToTypes() {
      const typeChecked = new Set([...document.querySelectorAll(".type:checked")].map(e => e.value));
      componentContainer.querySelectorAll("label").forEach((labelEl) => {
        const type = labelEl.getAttribute("data-type");
        const checkbox = labelEl.querySelector("input");
        if (!checkbox) return;
        checkbox.checked = typeChecked.has(type);
      });
      updateComponentStats();
    }

    async function loadComponents() {
      status.textContent = "Loading components...";
      const res = await fetch("/api/components", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ repo: repoInput.value, packagePath: pkgInput.value })
      });
      const data = await res.json();
      if (!res.ok) { status.textContent = data.error || "Failed loading components"; return; }
      loadedComponents = data.components || [];
      const grouped = loadedComponents.reduce((acc, c) => {
        (acc[c.type] = acc[c.type] || []).push(c);
        return acc;
      }, {});
      const typeOrder = ["ApexClass","ApexTrigger","LightningComponentBundle","AuraDefinitionBundle","Flow","CustomObject","CustomField","PermissionSet","FlexiPage","CustomLabel","StaticResource","VisualforcePage","Unknown"];
      componentContainer.innerHTML = typeOrder
        .filter(t => grouped[t]?.length)
        .map(t => '<div style="margin-bottom:8px"><strong>'+t+'</strong><div>' + grouped[t].map(c =>
          '<label data-type="'+c.type+'" style="display:block"><input type="checkbox" class="component" value="'+c.name+'" /> '+c.name+'</label>'
        ).join("") + '</div></div>')
        .join("");
      componentContainer.querySelectorAll(".component").forEach(cb => cb.addEventListener("change", updateComponentStats));
      syncComponentSelectionToTypes();
      applyComponentFilter();
      status.textContent = "Components loaded.";
    }

    async function runScan() {
      const runBtn = document.getElementById("run");
      runBtn.disabled = true;
      runBtn.textContent = "Running...";
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
        threshold: Number(thresholdInput.value || "70"),
        provider: document.getElementById("provider").value || undefined,
        backlogOut: document.getElementById("backlogOut").value || undefined,
        componentTypes: typeValues,
        components: componentValues
      };
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) {
          status.textContent = data.error || "Scan failed";
          return;
        }
        status.textContent = "Done. " + data.message + " (report: " + data.reportPath + ")";
        if (data.reportPath.endsWith(".html")) {
          frame.src = "/api/report?path=" + encodeURIComponent(data.reportPath);
        } else {
          frame.srcdoc = "<pre style='white-space:pre-wrap;padding:10px'>" + JSON.stringify(data.result, null, 2) + "</pre>";
        }
      } catch (e) {
        status.textContent = "Scan request failed: " + e;
      } finally {
        runBtn.disabled = false;
        runBtn.textContent = "Run Scanner";
      }
    }

    function setAll(selector, checked) {
      document.querySelectorAll(selector).forEach(el => { el.checked = checked; });
    }

    document.getElementById("selectAllTypes").addEventListener("click", () => {
      setAll(".type", true);
      syncComponentSelectionToTypes();
      applyComponentFilter();
    });
    document.getElementById("clearAllTypes").addEventListener("click", () => {
      setAll(".type", false);
      syncComponentSelectionToTypes();
      applyComponentFilter();
    });
    document.getElementById("selectAllComponents").addEventListener("click", () => {
      componentContainer.querySelectorAll("label").forEach(labelEl => {
        if (labelEl.style.display !== "none") labelEl.querySelector("input").checked = true;
      });
      updateComponentStats();
    });
    document.getElementById("clearAllComponents").addEventListener("click", () => {
      setAll(".component", false);
      updateComponentStats();
    });
    componentSearch.addEventListener("input", applyComponentFilter);
    document.querySelectorAll(".type").forEach(cb => cb.addEventListener("change", () => {
      syncComponentSelectionToTypes();
      applyComponentFilter();
    }));

    modeSelect.addEventListener("change", () => {
      const isCi = modeSelect.value === "ci";
      thresholdInput.disabled = !isCi;
    });
    modeSelect.dispatchEvent(new Event("change"));

    document.getElementById("load").addEventListener("click", loadComponents);
    document.getElementById("run").addEventListener("click", runScan);
    loadComponents();
  </script>
</body>
</html>`;
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function sendJson(
  res: http.ServerResponse,
  status: number,
  payload: unknown,
): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function collectComponents(
  repo: string,
  packagePath?: string,
): Array<{ name: string; type: MetadataType }> {
  const roots = detectMetadataRoots(repo);
  const discovered = roots.flatMap((root) => {
    const core = [...parseApex(root), ...parseLwc(root), ...parseFlows(root)];
    const catalog = parseMetadataCatalog(root);
    return [...core, ...catalog];
  });
  const dedup = new Map(discovered.map((n) => [`${n.type}:${n.name}`, n]));
  const nodes = filterNodesByPackage([...dedup.values()], packagePath);
  const seen = new Set<string>();
  const components: Array<{ name: string; type: MetadataType }> = [];
  for (const node of nodes) {
    const key = `${node.type}:${node.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    components.push({ name: node.name, type: node.type });
  }
  return components.sort(
    (a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name),
  );
}

export function startUiServer(opts: UiOptions): void {
  const server = http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url ?? "/", `http://${req.headers.host}`);

    if (req.method === "GET" && reqUrl.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(htmlPage(opts));
      return;
    }

    if (req.method === "POST" && reqUrl.pathname === "/api/components") {
      try {
        const body = JSON.parse(await readBody(req)) as {
          repo?: string;
          packagePath?: string;
        };
        const repo = body.repo ?? opts.repo;
        const packagePath = body.packagePath ?? opts.packagePath;
        const components = collectComponents(
          path.resolve(repo),
          packagePath ? path.resolve(packagePath) : undefined,
        );
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
        const reportPath = path.resolve(
          process.cwd(),
          `orglens-report.${format === "md" ? "md" : format}`,
        );
        await analyzeCommand({
          repo,
          packagePath: body.packagePath
            ? path.resolve(`${body.packagePath}`)
            : opts.packagePath,
          targetOrg: `${body.targetOrg ?? opts.targetOrg ?? ""}` || undefined,
          format: format as "json" | "md" | "html",
          mode: `${body.mode ?? "local"}` as "local" | "ci" | "governance",
          out: reportPath,
          threshold: body.threshold ? Number(body.threshold) : undefined,
          provider: body.provider
            ? (`${body.provider}` as "openai" | "anthropic")
            : undefined,
          team: `${body.team ?? "Architecture"}`,
          releaseTrain: `${body.releaseTrain ?? "R1"}`,
          backlogOut: body.backlogOut
            ? path.resolve(`${body.backlogOut}`)
            : undefined,
          componentTypes: Array.isArray(body.componentTypes)
            ? (body.componentTypes.filter(Boolean) as MetadataType[])
            : undefined,
          components: Array.isArray(body.components)
            ? body.components.map((c) => `${c}`)
            : undefined,
        });
        let result: unknown = null;
        if (format !== "html" && fs.existsSync(reportPath)) {
          result = JSON.parse(fs.readFileSync(reportPath, "utf8"));
        }
        sendJson(res, 200, {
          message: "Analysis complete",
          reportPath,
          result,
        });
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
    console.log(`OrgLens UI available at http://127.0.0.1:${opts.port}`);
  });
}
