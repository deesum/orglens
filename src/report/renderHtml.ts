import { AnalysisResult } from "../types/models.js";
import { recommendedFixForFinding } from "./fixGuidance.js";

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderHtml(result: AnalysisResult): string {
  const findingsById = new Map(result.findings.map((f) => [f.id, f]));
  const ruleSummaryMap = new Map<string, { count: number; severity: string; files: Set<string> }>();
  for (const finding of result.findings) {
    const current = ruleSummaryMap.get(finding.ruleName) ?? {
      count: 0,
      severity: finding.severity.toUpperCase(),
      files: new Set<string>(),
    };
    current.count += 1;
    current.files.add(finding.filePath);
    if (finding.severity === "critical") current.severity = "CRITICAL";
    else if (finding.severity === "high" && current.severity !== "CRITICAL") current.severity = "HIGH";
    else if (
      finding.severity === "medium" &&
      current.severity !== "CRITICAL" &&
      current.severity !== "HIGH"
    ) {
      current.severity = "MEDIUM";
    }
    ruleSummaryMap.set(finding.ruleName, current);
  }
  const ruleSummaryRows = [...ruleSummaryMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(
      ([rule, data]) =>
        `<tr><td>${escapeHtml(rule)}</td><td>${data.count}</td><td>${escapeHtml(data.severity)}</td><td>${escapeHtml(
          [...data.files].slice(0, 3).join(", "),
        )}</td></tr>`,
    )
    .join("");

  const debtRows = result.topDebts
    .slice(0, 10)
    .map((d) => {
      const finding = findingsById.get(d.findingId);
      const where = finding ? `${finding.filePath}${finding.line ? `:${finding.line}` : ""}` : "unknown";
      const what = finding ? `${finding.ruleName} - ${finding.message}` : d.findingId;
      const why = finding
        ? `${finding.severity.toUpperCase()} severity in ${finding.category} with blast radius ${d.blastRadius}.`
        : d.fixNowReason;
      const fix = finding ? recommendedFixForFinding(finding) : "Review finding details and apply rule guidance.";
      return `<tr>
        <td>${escapeHtml(d.findingId)}</td>
        <td>${d.priorityScore}</td>
        <td>${d.effort}</td>
        <td>${escapeHtml(what)}</td>
        <td>${escapeHtml(where)}</td>
        <td>${escapeHtml(why)}</td>
        <td>${escapeHtml(fix)}</td>
      </tr>`;
    })
    .join("");

  const recommendations = result.recommendations
    .map(
      (r) => `<article class="card recommendation">
        <h4>${escapeHtml(r.title)}</h4>
        <p>${escapeHtml(r.rationale)}</p>
        <p><strong>Evidence:</strong> ${escapeHtml(r.evidenceFindingIds.join(", "))}</p>
        <p><strong>Impacted:</strong> ${escapeHtml(r.impactedArtifacts.join(", "))}</p>
        <p><strong>Effort:</strong> ${r.effort} | <strong>Deferred Risk:</strong> ${escapeHtml(r.deferredRisk)}</p>
      </article>`,
    )
    .join("");
  const playbookRows = result.playbooks
    .slice(0, 10)
    .map(
      (p) =>
        `<tr><td>${escapeHtml(p.findingId)}</td><td>${escapeHtml(p.domain)}</td><td>${escapeHtml(
          p.ruleName,
        )}</td><td>${escapeHtml(p.whyPriority)}</td><td>${escapeHtml(
          p.fixSteps.join(" | "),
        )}</td><td>${escapeHtml(p.verificationSteps.join(" | "))}</td></tr>`,
    )
    .join("");

  const healthClass = result.score.overall >= 85 ? "good" : result.score.overall >= 70 ? "warn" : "bad";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>CRE Report</title>
  <style>
    :root {
      --bg: #0b1020;
      --panel: #121a30;
      --panel-2: #1a2542;
      --text: #e9eefc;
      --muted: #9fb0d9;
      --good: #22c55e;
      --warn: #f59e0b;
      --bad: #ef4444;
      --border: #2a365f;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      background: linear-gradient(180deg, var(--bg), #0e1428 40%);
      color: var(--text);
      line-height: 1.45;
    }
    .container { max-width: 1280px; margin: 0 auto; padding: 20px; }
    .topbar {
      position: sticky; top: 0; z-index: 10;
      backdrop-filter: blur(8px);
      background: rgba(11,16,32,0.88);
      border-bottom: 1px solid var(--border);
      padding: 12px 20px;
      display: flex; flex-wrap: wrap; gap: 10px;
    }
    .topbar a {
      color: var(--muted);
      text-decoration: none;
      padding: 6px 10px;
      border: 1px solid transparent;
      border-radius: 8px;
    }
    .topbar a:hover { color: var(--text); border-color: var(--border); }
    h1 { margin: 8px 0 4px; }
    h2 { margin-top: 30px; border-bottom: 1px solid var(--border); padding-bottom: 8px; }
    h4 { margin: 0 0 8px; }
    .muted { color: var(--muted); }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
      margin: 16px 0;
    }
    .card {
      background: linear-gradient(180deg, var(--panel), var(--panel-2));
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 14px;
      box-shadow: 0 8px 18px rgba(0,0,0,0.22);
    }
    .kpi .label { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
    .kpi .value { font-size: 30px; font-weight: 700; margin-top: 4px; }
    .pill { display: inline-block; padding: 4px 8px; border-radius: 999px; font-size: 12px; font-weight: 700; border: 1px solid var(--border); background: #1b2748; }
    .good { color: #86efac; }
    .warn { color: #fcd34d; }
    .bad { color: #fca5a5; }
    .controls { display: flex; gap: 10px; flex-wrap: wrap; margin: 10px 0 14px; }
    input, select {
      background: #0f1833;
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 8px 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: #0f1833;
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
    }
    th, td {
      border-bottom: 1px solid var(--border);
      padding: 10px;
      vertical-align: top;
      text-align: left;
      font-size: 13px;
    }
    th { background: #17244a; position: sticky; top: 54px; z-index: 1; cursor: pointer; }
    tr:hover td { background: rgba(96,165,250,0.08); }
    .recommendation p { margin: 6px 0; font-size: 13px; }
    details {
      border: 1px solid var(--border);
      border-radius: 10px;
      background: #0f1833;
      margin: 10px 0;
      padding: 8px 10px;
    }
    summary { cursor: pointer; font-weight: 600; }
    .small { font-size: 12px; color: var(--muted); white-space: pre-wrap; }
  </style>
</head>
<body>
  <nav class="topbar">
    <a href="#overview">Overview</a>
    <a href="#debts">Top Debts</a>
    <a href="#recommendations">Recommendations</a>
    <a href="#playbooks">Playbooks</a>
    <a href="#rules">Rule Summary</a>
    <a href="#trend">Trend</a>
  </nav>
  <main class="container">
    <section id="overview">
      <h1>Config Reverse Engineer Report</h1>
      <p class="muted">Action-first metadata debt analysis with prioritization and remediation guidance.</p>
      <div class="grid">
        <article class="card kpi">
          <div class="label">Health Score</div>
          <div class="value ${healthClass}">${result.score.overall}</div>
        </article>
        <article class="card kpi">
          <div class="label">Confidence</div>
          <div class="value">${result.score.confidence}%</div>
        </article>
        <article class="card kpi">
          <div class="label">Scanner</div>
          <div class="value"><span class="pill">${result.scannerStatus}</span></div>
          <p class="small">${escapeHtml(result.scannerMessage ?? "n/a")}</p>
        </article>
        <article class="card kpi">
          <div class="label">Dependency Impact</div>
          <div class="value">${result.graph.nodes.length} / ${result.graph.edges.length}</div>
          <p class="small">nodes / edges</p>
        </article>
      </div>
    </section>

    <section id="debts">
      <h2>Top Debt Items</h2>
      <div class="controls">
        <input id="debtSearch" placeholder="Search finding, rule, file..." />
        <select id="effortFilter">
          <option value="">All efforts</option>
          <option value="S">S</option>
          <option value="M">M</option>
          <option value="L">L</option>
        </select>
      </div>
      <table id="debtTable">
        <thead>
          <tr>
            <th data-sort="0">Finding</th><th data-sort="1">Priority</th><th data-sort="2">Effort</th>
            <th data-sort="3">What</th><th data-sort="4">Where</th><th data-sort="5">Why</th><th data-sort="6">How To Fix</th>
          </tr>
        </thead>
        <tbody>${debtRows}</tbody>
      </table>
    </section>

    <section id="recommendations">
      <h2>Recommendations</h2>
      <div class="grid">${recommendations || `<article class="card"><p>No recommendations generated.</p></article>`}</div>
    </section>

    <section id="trend">
      <h2>Trend Delta</h2>
      <div class="grid">
        <article class="card"><h4>Status</h4><p>${result.trend.status}</p></article>
        <article class="card"><h4>Previous Score / Delta</h4><p>${result.trend.previousScore ?? "n/a"} / ${result.trend.scoreDelta ?? "n/a"}</p></article>
        <article class="card"><h4>Previous Finding Count / Delta</h4><p>${result.trend.previousFindingCount ?? "n/a"} / ${result.trend.findingDelta ?? "n/a"}</p></article>
      </div>
    </section>

    <section id="playbooks">
      <h2>Domain Playbooks</h2>
      <details open>
        <summary>View remediation playbooks</summary>
        <table>
          <tr><th>Finding</th><th>Domain</th><th>Rule</th><th>Why Priority</th><th>Fix Steps</th><th>Verification</th></tr>
          ${playbookRows}
        </table>
      </details>
    </section>

    <section id="rules">
      <h2>Summary By Rule</h2>
      <table>
        <tr><th>Rule</th><th>Count</th><th>Max Severity</th><th>Example Files</th></tr>
        ${ruleSummaryRows}
      </table>
    </section>

    <section id="backlog">
      <h2>Jira Backlog Export</h2>
      <article class="card"><p>Backlog Items: <strong>${result.backlog.length}</strong></p></article>
    </section>
  </main>
  <script>
    (function () {
      const table = document.getElementById("debtTable");
      if (!table) return;
      const tbody = table.querySelector("tbody");
      const search = document.getElementById("debtSearch");
      const effort = document.getElementById("effortFilter");
      const rows = Array.from(tbody.querySelectorAll("tr"));
      const sortState = {};
      function applyFilters() {
        const q = (search.value || "").toLowerCase();
        const effortValue = effort.value;
        rows.forEach((row) => {
          const txt = row.textContent.toLowerCase();
          const effortCell = row.children[2]?.textContent?.trim() || "";
          row.style.display = (!q || txt.includes(q)) && (!effortValue || effortCell === effortValue) ? "" : "none";
        });
      }
      search.addEventListener("input", applyFilters);
      effort.addEventListener("change", applyFilters);
      table.querySelectorAll("th[data-sort]").forEach((th) => {
        th.addEventListener("click", () => {
          const idx = Number(th.getAttribute("data-sort"));
          const asc = !sortState[idx];
          sortState[idx] = asc;
          rows.sort((a, b) => {
            const av = a.children[idx]?.textContent?.trim() || "";
            const bv = b.children[idx]?.textContent?.trim() || "";
            const an = Number(av);
            const bn = Number(bv);
            const cmp = !Number.isNaN(an) && !Number.isNaN(bn) ? an - bn : av.localeCompare(bv);
            return asc ? cmp : -cmp;
          });
          rows.forEach((r) => tbody.appendChild(r));
          applyFilters();
        });
      });
    })();
  </script>
</body>
</html>`;
}
