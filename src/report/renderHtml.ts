import { AnalysisResult, AnalyzerFinding } from "../types/models.js";
import { recommendedFixForFinding } from "./fixGuidance.js";
import { ruleDocUrl } from "./ruleDocs.js";

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function compactPath(filePath: string): string {
  const normalized = filePath.replaceAll("\\", "/");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length <= 4) return normalized;
  return `.../${parts.slice(-4).join("/")}`;
}

function compactKnownPaths(text: string, paths: string[]): string {
  let output = text;
  for (const filePath of paths) {
    if (!filePath) continue;
    output = output.split(filePath).join(compactPath(filePath));
  }
  return output;
}

function deriveComponentName(finding: AnalyzerFinding): string {
  if (finding.componentName) return finding.componentName;
  const parts = finding.filePath.replaceAll("\\", "/").split("/");
  const file = parts[parts.length - 1] ?? "";
  return file.replace(/\.(cls|trigger|js|html|css|flow-meta\.xml|object-meta\.xml|field-meta\.xml)$/, "");
}

function severityBadge(sev: string): string {
  const cls =
    sev === "critical" ? "sev-critical"
    : sev === "high" ? "sev-high"
    : sev === "medium" ? "sev-medium"
    : "sev-low";
  return `<span class="badge ${cls}">${escapeHtml(sev.toUpperCase())}</span>`;
}

export function renderHtml(result: AnalysisResult): string {
  const findingsById = new Map(result.findings.map((f) => [f.id, f]));
  const knownPaths = [...new Set(result.findings.map((f) => f.filePath))].sort(
    (a, b) => b.length - a.length,
  );

  // ── Rule summary ──────────────────────────────────────────────────────────
  const ruleSummaryMap = new Map<
    string,
    { count: number; severity: string; files: Set<string>; sample: AnalyzerFinding }
  >();
  for (const finding of result.findings) {
    const cur = ruleSummaryMap.get(finding.ruleName) ?? {
      count: 0,
      severity: finding.severity.toUpperCase(),
      files: new Set<string>(),
      sample: finding,
    };
    cur.count += 1;
    cur.files.add(finding.filePath);
    if (finding.severity === "critical") cur.severity = "CRITICAL";
    else if (finding.severity === "high" && cur.severity !== "CRITICAL") cur.severity = "HIGH";
    else if (
      finding.severity === "medium" &&
      cur.severity !== "CRITICAL" &&
      cur.severity !== "HIGH"
    )
      cur.severity = "MEDIUM";
    ruleSummaryMap.set(finding.ruleName, cur);
  }
  const ruleSummaryRows = [...ruleSummaryMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 25)
    .map(([rule, data]) => {
      const sc =
        data.severity === "CRITICAL"
          ? "sev-critical"
          : data.severity === "HIGH"
            ? "sev-high"
            : data.severity === "MEDIUM"
              ? "sev-medium"
              : "sev-low";
      const docUrl = ruleDocUrl(data.sample);
      const ruleCell = docUrl
        ? `<a class="rule-link" href="${escapeHtml(docUrl)}" target="_blank" rel="noopener">${escapeHtml(rule)} <span class="ext">↗</span></a>`
        : escapeHtml(rule);
      const refCell = docUrl
        ? `<a class="btn-link" href="${escapeHtml(docUrl)}" target="_blank" rel="noopener">View docs ↗</a>`
        : `<span class="muted-text">—</span>`;
      return `<tr>
        <td>${ruleCell}</td>
        <td><strong>${data.count}</strong></td>
        <td><span class="badge ${sc}">${escapeHtml(data.severity)}</span></td>
        <td class="path-col">${escapeHtml(
          [...data.files]
            .slice(0, 3)
            .map((f) => compactPath(f))
            .join(" · "),
        )}</td>
        <td>${refCell}</td>
      </tr>`;
    })
    .join("");

  // ── Severity distribution ─────────────────────────────────────────────────
  const sev = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of result.findings) {
    if (f.severity in sev) sev[f.severity as keyof typeof sev]++;
  }
  const sevBar = `
    <div class="sev-bar-wrap">
      ${sev.critical > 0 ? `<div class="sev-seg seg-critical" style="flex:${sev.critical}" title="Critical: ${sev.critical}"><span>${sev.critical}</span></div>` : ""}
      ${sev.high > 0 ? `<div class="sev-seg seg-high" style="flex:${sev.high}" title="High: ${sev.high}"><span>${sev.high}</span></div>` : ""}
      ${sev.medium > 0 ? `<div class="sev-seg seg-medium" style="flex:${sev.medium}" title="Medium: ${sev.medium}"><span>${sev.medium}</span></div>` : ""}
      ${sev.low > 0 ? `<div class="sev-seg seg-low" style="flex:${sev.low}" title="Low: ${sev.low}"><span>${sev.low}</span></div>` : ""}
    </div>
    <div class="sev-legend">
      <span class="c-critical">● Critical: ${sev.critical}</span>
      <span class="c-high">● High: ${sev.high}</span>
      <span class="c-medium">● Medium: ${sev.medium}</span>
      <span class="c-low">● Low: ${sev.low}</span>
    </div>`;

  // ── Component issue map (top chips) ──────────────────────────────────────
  const compMap = new Map<string, { count: number; maxSev: string }>();
  for (const f of result.findings) {
    const name = deriveComponentName(f);
    const cur = compMap.get(name) ?? { count: 0, maxSev: "low" };
    cur.count++;
    if (f.severity === "critical") cur.maxSev = "critical";
    else if (f.severity === "high" && cur.maxSev !== "critical") cur.maxSev = "high";
    else if (
      f.severity === "medium" &&
      !["critical", "high"].includes(cur.maxSev)
    )
      cur.maxSev = "medium";
    compMap.set(name, cur);
  }
  const topComps = [...compMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 15);
  const compChipsHtml = topComps
    .map(
      ([name, d]) =>
        `<button class="comp-chip sev-chip-${d.maxSev}" data-comp="${escapeHtml(name)}" title="${d.count} issues">${escapeHtml(name)} <span class="chip-count">${d.count}</span></button>`,
    )
    .join("");

  // ── Effort counts ─────────────────────────────────────────────────────────
  const eff = { S: 0, M: 0, L: 0 };
  for (const d of result.topDebts) {
    if (d.effort in eff) eff[d.effort as keyof typeof eff]++;
  }

  // ── Debt rows ─────────────────────────────────────────────────────────────
  const maxRows = 200;
  const quickWins: Array<{ finding: AnalyzerFinding; priority: number }> = [];
  const debtRows = result.topDebts
    .slice(0, maxRows)
    .map((d, idx) => {
      const finding = findingsById.get(d.findingId);
      const compName = finding ? deriveComponentName(finding) : "";
      const mdType = finding?.metadataType ?? "Unknown";
      const where = finding
        ? `${compactPath(finding.filePath)}${finding.line ? `:${finding.line}` : ""}`
        : "unknown";
      const docUrl = finding ? ruleDocUrl(finding) : undefined;
      const ruleLabel = finding ? finding.ruleName : d.findingId;
      const ruleHtml = docUrl
        ? `<a class="rule-link" href="${escapeHtml(docUrl)}" target="_blank" rel="noopener">${escapeHtml(ruleLabel)} <span class="ext">↗</span></a>`
        : escapeHtml(ruleLabel);
      const what = finding ? `${ruleHtml} — ${escapeHtml(finding.message)}` : escapeHtml(d.findingId);
      const why = finding
        ? `${finding.severity.toUpperCase()} severity in ${finding.category}. Blast radius ${d.blastRadius}.`
        : d.fixNowReason;
      const fix = finding
        ? recommendedFixForFinding(finding)
        : "Review finding details and apply rule guidance.";
      const findingId = d.findingId?.trim() ? d.findingId : `finding-${idx + 1}`;
      const severity = finding?.severity ?? "low";
      if (
        finding &&
        (severity === "critical" || severity === "high") &&
        d.effort === "S" &&
        quickWins.length < 12
      ) {
        quickWins.push({ finding, priority: d.priorityScore });
      }
      return `<tr data-severity="${severity}" data-component="${escapeHtml(compName)}" data-type="${escapeHtml(mdType)}">
        <td>${severityBadge(severity)}</td>
        <td><code class="finding-id">${escapeHtml(findingId)}</code></td>
        <td><strong>${d.priorityScore}</strong></td>
        <td><span class="badge eff-${d.effort}">${d.effort}</span></td>
        <td class="comp-cell">${escapeHtml(compName)}</td>
        <td>${what}</td>
        <td class="path-col">${escapeHtml(where)}</td>
        <td>${escapeHtml(why)}</td>
        <td>${escapeHtml(fix)}</td>
      </tr>`;
    })
    .join("");

  // ── Quick wins (high impact, low effort) ──────────────────────────────────
  const quickWinCards = quickWins
    .map(({ finding, priority }) => {
      const docUrl = ruleDocUrl(finding);
      const ruleHtml = docUrl
        ? `<a class="rule-link" href="${escapeHtml(docUrl)}" target="_blank" rel="noopener">${escapeHtml(finding.ruleName)} ↗</a>`
        : escapeHtml(finding.ruleName);
      return `<article class="card qw-card">
        <div class="rec-header">
          <h4>${ruleHtml}</h4>
          ${severityBadge(finding.severity)}
        </div>
        <p>${escapeHtml(finding.message)}</p>
        <p class="path-col" style="white-space:normal">${escapeHtml(compactPath(finding.filePath))}${finding.line ? `:${finding.line}` : ""}</p>
        <p style="font-size:11px;color:var(--muted)">Priority ${priority} · Effort S · ${escapeHtml(deriveComponentName(finding))}</p>
      </article>`;
    })
    .join("");

  // ── Metadata type options for filter ──────────────────────────────────────
  const typeCounts = new Map<string, number>();
  for (const d of result.topDebts.slice(0, maxRows)) {
    const f = findingsById.get(d.findingId);
    const t = f?.metadataType ?? "Unknown";
    typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
  }
  const typeOptions = [...typeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([t, c]) => `<option value="${escapeHtml(t)}">${escapeHtml(t)} (${c})</option>`)
    .join("");

  // ── Recommendations ───────────────────────────────────────────────────────
  const recsHtml = result.recommendations
    .map(
      (r) => `<article class="card recommendation">
        <div class="rec-header">
          <h4>${escapeHtml(r.title)}</h4>
          <span class="badge eff-${r.effort}">Effort ${r.effort}</span>
        </div>
        <p>${escapeHtml(r.rationale)}</p>
        <p><strong style="color:var(--text)">Evidence:</strong> ${escapeHtml(r.evidenceFindingIds.join(", "))}</p>
        <p><strong style="color:var(--text)">Impacted:</strong> ${escapeHtml(r.impactedArtifacts.map((a) => compactPath(a)).join(", "))}</p>
        <p class="risk-text"><strong style="color:var(--text)">Deferred Risk:</strong> ${escapeHtml(r.deferredRisk)}</p>
      </article>`,
    )
    .join("");

  // ── Playbook rows ─────────────────────────────────────────────────────────
  const playbookRows = result.playbooks
    .slice(0, 20)
    .map(
      (p) =>
        `<tr>
          <td><code class="finding-id">${escapeHtml(p.findingId)}</code></td>
          <td><span class="badge domain-${escapeHtml(p.domain.toLowerCase())}">${escapeHtml(p.domain)}</span></td>
          <td>${escapeHtml(p.ruleName)}</td>
          <td>${escapeHtml(compactKnownPaths(p.whyPriority, knownPaths))}</td>
          <td>${escapeHtml(p.fixSteps.join(" · "))}</td>
          <td>${escapeHtml(p.verificationSteps.join(" · "))}</td>
        </tr>`,
    )
    .join("");

  // ── Score metadata ────────────────────────────────────────────────────────
  const healthClass =
    result.score.overall >= 85 ? "c-low" : result.score.overall >= 70 ? "c-medium" : "c-critical";
  const healthLabel =
    result.score.overall >= 85
      ? "Healthy"
      : result.score.overall >= 70
        ? "Needs Attention"
        : "At Risk";
  const timestamp = result.timestamp
    ? new Date(result.timestamp).toLocaleString()
    : "—";

  // ── Trend helpers ─────────────────────────────────────────────────────────
  const scoreDeltaStr =
    result.trend.scoreDelta != null
      ? (result.trend.scoreDelta > 0 ? "+" : "") + result.trend.scoreDelta
      : "n/a";
  const findingDeltaStr =
    result.trend.findingDelta != null
      ? (result.trend.findingDelta > 0 ? "+" : "") + result.trend.findingDelta
      : "n/a";
  const scoreDeltaClass =
    result.trend.scoreDelta != null && result.trend.scoreDelta > 0 ? "c-low" : "c-critical";
  const findingDeltaClass =
    result.trend.findingDelta != null && result.trend.findingDelta < 0 ? "c-low" : "c-critical";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>CRE — Config Reverse Engineer Report</title>
  <style>
    :root {
      --bg:      #060d1f;
      --surface: #0a1428;
      --panel:   #0f1d35;
      --panel2:  #162445;
      --text:    #e8eeff;
      --muted:   #7e98c4;
      --accent:  #3b82f6;
      --adim:    #1e3a5f;
      --border:  #1e3054;
      --critical: #ef4444;  --cbg: rgba(239,68,68,.12);
      --high:    #f97316;   --hbg: rgba(249,115,22,.12);
      --medium:  #eab308;   --mbg: rgba(234,179,8,.12);
      --low:     #22c55e;   --lbg: rgba(34,197,94,.12);
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Inter, system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); line-height: 1.5; font-size: 14px; }
    /* ── Nav ── */
    .topbar { position: sticky; top: 0; z-index: 200; background: rgba(6,13,31,.93); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); padding: 8px 24px; display: flex; gap: 2px; align-items: center; flex-wrap: wrap; }
    .brand { font-weight: 800; font-size: 15px; color: var(--accent); margin-right: 16px; letter-spacing: -.02em; }
    .topbar a { color: var(--muted); text-decoration: none; padding: 5px 11px; border-radius: 7px; font-size: 13px; font-weight: 500; transition: all .15s; }
    .topbar a:hover { color: var(--text); background: var(--panel); }
    /* ── Layout ── */
    .container { max-width: 1480px; margin: 0 auto; padding: 28px 24px; }
    h1 { font-size: 28px; font-weight: 800; letter-spacing: -.03em; }
    h2 { font-size: 17px; font-weight: 700; margin: 36px 0 14px; padding-bottom: 9px; border-bottom: 1px solid var(--border); }
    h3 { font-size: 14px; font-weight: 700; }
    h4 { font-size: 13px; font-weight: 700; }
    .subtitle { color: var(--muted); font-size: 13px; margin: 4px 0 22px; }
    /* ── Cards ── */
    .card { background: linear-gradient(145deg, var(--panel), var(--panel2)); border: 1px solid var(--border); border-radius: 14px; padding: 18px; box-shadow: 0 4px 28px rgba(0,0,0,.32); }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(175px, 1fr)); gap: 14px; margin-bottom: 18px; }
    .kpi-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: var(--muted); margin-bottom: 6px; }
    .kpi-value { font-size: 38px; font-weight: 800; line-height: 1; }
    .kpi-sub { font-size: 12px; color: var(--muted); margin-top: 5px; }
    /* ── Score breakdown ── */
    .breakdown-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px,1fr)); gap: 10px; margin-top: 14px; }
    .breakdown-item { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 12px; text-align: center; }
    .b-val { font-size: 24px; font-weight: 800; color: var(--accent); }
    .b-label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; margin-top: 4px; }
    /* ── Severity distribution ── */
    .sev-bar-wrap { display: flex; height: 30px; border-radius: 8px; overflow: hidden; margin: 14px 0 8px; gap: 3px; }
    .sev-seg { display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; color: #fff; min-width: 24px; transition: flex .4s ease; }
    .seg-critical { background: var(--critical); }
    .seg-high     { background: var(--high); }
    .seg-medium   { background: var(--medium); color: #1a1000; }
    .seg-low      { background: var(--low); color: #001a00; }
    .sev-legend { display: flex; gap: 18px; flex-wrap: wrap; font-size: 12px; font-weight: 700; }
    /* ── Colour helpers ── */
    .c-critical { color: var(--critical); }
    .c-high     { color: var(--high); }
    .c-medium   { color: var(--medium); }
    .c-low      { color: var(--low); }
    /* ── Badges ── */
    .badge { display: inline-flex; align-items: center; padding: 2px 9px; border-radius: 7px; font-size: 11px; font-weight: 700; white-space: nowrap; line-height: 1.6; }
    .sev-critical { color: var(--critical); background: var(--cbg); border: 1px solid rgba(239,68,68,.35); }
    .sev-high     { color: var(--high);     background: var(--hbg); border: 1px solid rgba(249,115,22,.35); }
    .sev-medium   { color: var(--medium);   background: var(--mbg); border: 1px solid rgba(234,179,8,.35); }
    .sev-low      { color: var(--low);      background: var(--lbg); border: 1px solid rgba(34,197,94,.35); }
    .eff-S { color: #34d399; background: rgba(52,211,153,.12); border: 1px solid rgba(52,211,153,.3); }
    .eff-M { color: #fbbf24; background: rgba(251,191,36,.12); border: 1px solid rgba(251,191,36,.3); }
    .eff-L { color: #f87171; background: rgba(248,113,113,.12); border: 1px solid rgba(248,113,113,.3); }
    .pill { display: inline-block; padding: 4px 10px; border-radius: 99px; font-size: 11px; font-weight: 700; background: var(--adim); color: var(--accent); border: 1px solid var(--border); }
    .domain-apex    { color: #60a5fa; background: rgba(59,130,246,.15); border: 1px solid rgba(59,130,246,.3); }
    .domain-lwc     { color: #c084fc; background: rgba(192,132,252,.15); border: 1px solid rgba(192,132,252,.3); }
    .domain-flow    { color: #2dd4bf; background: rgba(45,212,191,.15); border: 1px solid rgba(45,212,191,.3); }
    .domain-general { color: var(--muted); background: var(--panel); border: 1px solid var(--border); }
    /* ── Component chips ── */
    .comp-chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0; }
    .comp-chip { background: var(--panel); border: 1px solid var(--border); border-radius: 20px; padding: 5px 13px; font-size: 12px; font-weight: 600; cursor: pointer; color: var(--muted); transition: all .15s; }
    .comp-chip:hover { color: var(--text); border-color: var(--accent); background: var(--adim); }
    .comp-chip.active { color: var(--text); border-color: var(--accent); background: var(--adim); box-shadow: 0 0 0 2px rgba(59,130,246,.35); }
    .sev-chip-critical.active { border-color: var(--critical); background: var(--cbg); }
    .sev-chip-high.active    { border-color: var(--high);     background: var(--hbg); }
    .sev-chip-medium.active  { border-color: var(--medium);   background: var(--mbg); }
    .chip-count { background: var(--adim); color: var(--accent); padding: 1px 6px; border-radius: 99px; font-size: 10px; margin-left: 4px; }
    /* ── Controls ── */
    .controls { display: flex; gap: 8px; flex-wrap: wrap; margin: 12px 0 4px; align-items: center; }
    .controls input, .controls select { background: var(--panel); color: var(--text); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; font-size: 13px; }
    .controls input { min-width: 240px; }
    .controls input:focus, .controls select:focus { outline: none; border-color: var(--accent); }
    .btn { display: inline-flex; align-items: center; gap: 5px; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid var(--border); background: var(--panel); color: var(--muted); transition: all .15s; }
    .btn:hover { border-color: var(--accent); color: var(--text); }
    .btn-accent { background: var(--accent); border-color: var(--accent); color: #fff; }
    .btn-accent:hover { background: #2563eb; }
    /* ── Filter tags ── */
    .filter-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; min-height: 24px; }
    .filter-tag { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; background: var(--adim); border: 1px solid var(--accent); border-radius: 99px; font-size: 12px; color: var(--accent); }
    .filter-tag .xtag { cursor: pointer; font-size: 14px; line-height: 1; }
    /* ── Tables ── */
    .table-wrap { overflow-x: auto; border-radius: 12px; border: 1px solid var(--border); }
    table { width: 100%; border-collapse: collapse; background: var(--surface); font-size: 13px; }
    th, td { border-bottom: 1px solid var(--border); padding: 10px 12px; text-align: left; vertical-align: top; }
    th { background: var(--panel2); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); cursor: pointer; position: sticky; top: 0; white-space: nowrap; user-select: none; z-index: 1; }
    th:hover { color: var(--text); }
    tbody tr:nth-child(even) td { background: rgba(255,255,255,.016); }
    tbody tr:hover td { background: rgba(59,130,246,.07); }
    tbody tr[data-severity="critical"] td:first-child { border-left: 3px solid var(--critical); }
    tbody tr[data-severity="high"]     td:first-child { border-left: 3px solid var(--high); }
    tbody tr[data-severity="medium"]   td:first-child { border-left: 3px solid var(--medium); }
    tbody tr[data-severity="low"]      td:first-child { border-left: 3px solid var(--low); }
    td.path-col { font-family: ui-monospace, Menlo, Monaco, Consolas, monospace; font-size: 11px; color: #93c5fd; white-space: nowrap; }
    td.comp-cell { font-weight: 600; color: #a5b4fc; }
    code.finding-id { font-family: ui-monospace, Menlo, monospace; font-size: 11px; background: var(--panel); padding: 1px 5px; border-radius: 4px; color: var(--muted); }
    /* ── Recommendations ── */
    .rec-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 14px; }
    .recommendation { border-left: 3px solid var(--accent); }
    .rec-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
    .recommendation p { font-size: 13px; color: var(--muted); margin: 5px 0; overflow-wrap: anywhere; word-break: break-word; }
    .risk-text { color: #fca5a5 !important; font-size: 12px !important; }
    /* ── Playbooks ── */
    details { border: 1px solid var(--border); border-radius: 12px; margin: 8px 0; overflow: hidden; }
    summary { cursor: pointer; padding: 12px 18px; font-weight: 700; font-size: 13px; background: var(--panel); list-style: none; }
    summary::-webkit-details-marker { display: none; }
    summary::before { content: "▶  "; font-size: 10px; }
    details[open] summary::before { content: "▼  "; }
    details > .table-wrap { border-radius: 0; border: none; border-top: 1px solid var(--border); }
    /* ── Trend ── */
    .trend-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; }
    /* ── Row count helper ── */
    .row-count { font-size: 12px; color: var(--muted); margin-bottom: 10px; }
    .row-count strong { color: var(--text); }
    /* ── Rule links ── */
    .rule-link { color: #93c5fd; text-decoration: none; font-weight: 600; border-bottom: 1px dotted rgba(147,197,253,.5); }
    .rule-link:hover { color: #bfdbfe; border-bottom-style: solid; }
    .rule-link .ext { font-size: 10px; opacity: .7; }
    .btn-link { display: inline-block; color: var(--accent); text-decoration: none; font-size: 12px; font-weight: 600; padding: 3px 10px; border: 1px solid var(--border); border-radius: 7px; transition: all .15s; white-space: nowrap; }
    .btn-link:hover { border-color: var(--accent); background: var(--adim); color: var(--text); }
    .muted-text { color: var(--muted); }
    /* ── Quick wins ── */
    .qw-card { border-left: 3px solid var(--low); }
    .qw-card h4 { font-size: 12px; }
    .qw-card p { font-size: 12px; color: var(--muted); margin: 5px 0; overflow-wrap: anywhere; }
    .banner { display: flex; align-items: center; gap: 10px; background: var(--lbg); border: 1px solid rgba(34,197,94,.3); border-radius: 12px; padding: 12px 16px; margin-bottom: 14px; font-size: 13px; color: var(--low); }
  </style>
</head>
<body>
  <nav class="topbar">
    <span class="brand">⚡ CRE</span>
    <a href="#overview">Overview</a>
    <a href="#rules">Rule Summary</a>
    <a href="#recommendations">Recommendations</a>
    <a href="#quickwins">Quick Wins</a>
    <a href="#issues">All Issues</a>
    <a href="#playbooks">Playbooks</a>
    <a href="#trend">Trend</a>
    <a href="#backlog">Backlog</a>
  </nav>
  <main class="container">

    <!-- ═══ OVERVIEW ═══════════════════════════════════════════════════════ -->
    <section id="overview">
      <h1>Config Reverse Engineer Report</h1>
      <p class="subtitle">Metadata health analysis · ${timestamp}</p>

      <div class="kpi-grid">
        <article class="card">
          <div class="kpi-label">Health Score</div>
          <div class="kpi-value ${healthClass}">${result.score.overall}</div>
          <div class="kpi-sub">${healthLabel}</div>
        </article>
        <article class="card">
          <div class="kpi-label">Total Findings</div>
          <div class="kpi-value">${result.findings.length}</div>
          <div class="kpi-sub">Across all scanned metadata</div>
        </article>
        <article class="card">
          <div class="kpi-label">Confidence</div>
          <div class="kpi-value">${result.score.confidence}%</div>
          <div class="kpi-sub">Analysis coverage</div>
        </article>
        <article class="card">
          <div class="kpi-label">Scanner</div>
          <div class="kpi-value" style="font-size:15px;margin-top:8px"><span class="pill">${result.scannerStatus}</span></div>
          <div class="kpi-sub">${escapeHtml((result.scannerMessage ?? "n/a").slice(0, 70))}</div>
        </article>
        <article class="card">
          <div class="kpi-label">Dependency Graph</div>
          <div class="kpi-value">${result.graph.nodes.length}</div>
          <div class="kpi-sub">${result.graph.edges.length} edges mapped</div>
        </article>
        <article class="card">
          <div class="kpi-label">Fix Effort Mix</div>
          <div style="display:flex;gap:6px;margin-top:10px">
            <span class="badge eff-S">S: ${eff.S}</span>
            <span class="badge eff-M">M: ${eff.M}</span>
            <span class="badge eff-L">L: ${eff.L}</span>
          </div>
          <div class="kpi-sub" style="margin-top:8px">Short · Medium · Large</div>
        </article>
      </div>

      <article class="card" style="margin-bottom:14px">
        <h3>Severity Distribution <span style="font-size:12px;font-weight:400;color:var(--muted);margin-left:8px">${result.findings.length} total findings</span></h3>
        ${sevBar}
      </article>

      <article class="card" style="margin-bottom:14px">
        <h3>Score Breakdown by Category</h3>
        <div class="breakdown-grid">
          <div class="breakdown-item"><div class="b-val">${result.score.breakdown.security}</div><div class="b-label">Security</div></div>
          <div class="breakdown-item"><div class="b-val">${result.score.breakdown.maintainability}</div><div class="b-label">Maintainability</div></div>
          <div class="breakdown-item"><div class="b-val">${result.score.breakdown.reliability}</div><div class="b-label">Reliability</div></div>
          <div class="breakdown-item"><div class="b-val">${result.score.breakdown.performance}</div><div class="b-label">Performance</div></div>
          <div class="breakdown-item"><div class="b-val">${result.score.breakdown.operability}</div><div class="b-label">Operability</div></div>
        </div>
      </article>

      <article class="card">
        <h3>Most Affected Components <span style="font-size:12px;font-weight:400;color:var(--muted);margin-left:6px">— click any chip to filter All Issues</span></h3>
        <div class="comp-chips" id="compChips">${compChipsHtml}</div>
      </article>
    </section>

    <!-- ═══ RULE SUMMARY ═══════════════════════════════════════════════════ -->
    <section id="rules">
      <h2>Rule Summary</h2>
      <p class="row-count">Top <strong>${Math.min(ruleSummaryMap.size, 25)}</strong> rules by occurrence — <strong>${ruleSummaryMap.size}</strong> distinct rules across <strong>${result.findings.length}</strong> findings.</p>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Rule</th><th>Count</th><th>Max Severity</th><th>Example Files</th><th>Reference</th>
          </tr></thead>
          <tbody>${ruleSummaryRows}</tbody>
        </table>
      </div>
    </section>

    <!-- ═══ RECOMMENDATIONS ════════════════════════════════════════════════ -->
    <section id="recommendations">
      <h2>Recommendations</h2>
      <div class="rec-grid">${recsHtml || `<article class="card"><p>No LLM recommendations generated. Set <code>OPENAI_API_KEY</code> or <code>ANTHROPIC_API_KEY</code> to enable AI-powered remediation guidance.</p></article>`}</div>
    </section>

    <!-- ═══ QUICK WINS ═════════════════════════════════════════════════════ -->
    <section id="quickwins">
      <h2>Quick Wins <span style="font-size:12px;font-weight:400;color:var(--muted);margin-left:8px">High impact · Low effort</span></h2>
      ${
        quickWins.length
          ? `<div class="banner">✓ ${quickWins.length} high-severity issues can be resolved with short (S) effort — prioritise these for immediate ROI.</div>
             <div class="rec-grid">${quickWinCards}</div>`
          : `<article class="card"><p style="color:var(--muted)">No high-severity, low-effort items detected. Review the All Issues table for the full prioritised backlog.</p></article>`
      }
    </section>

    <!-- ═══ ALL ISSUES ═════════════════════════════════════════════════════ -->
    <section id="issues">
      <h2>All Issues</h2>
      <p class="row-count">
        Showing top <strong id="visibleCount">${Math.min(result.topDebts.length, maxRows)}</strong> of <strong>${result.topDebts.length}</strong> ranked findings.
        Install Java + Salesforce Code Analyzer (<code>sf plugins install @salesforce/sfdx-scanner</code>) for complete rule coverage.
      </p>
      <div class="filter-tags" id="filterTags"></div>
      <div class="controls">
        <input id="issueSearch" placeholder="🔍 Search rule, file, component…" />
        <select id="sevFilter">
          <option value="">All Severities</option>
          <option value="critical">🔴 Critical</option>
          <option value="high">🟠 High</option>
          <option value="medium">🟡 Medium</option>
          <option value="low">🟢 Low</option>
        </select>
        <select id="effortFilter">
          <option value="">All Efforts</option>
          <option value="S">S — Short</option>
          <option value="M">M — Medium</option>
          <option value="L">L — Large</option>
        </select>
        <select id="typeFilter">
          <option value="">All Types</option>
          ${typeOptions}
        </select>
        <button class="btn btn-accent" id="exportCsvBtn">⬇ Export CSV</button>
        <button class="btn" id="clearFiltersBtn">✕ Clear All</button>
      </div>
      <div class="table-wrap">
        <table id="issueTable">
          <thead><tr>
            <th data-col="0">Severity</th>
            <th data-col="1">ID</th>
            <th data-col="2">Priority ↓</th>
            <th data-col="3">Effort</th>
            <th data-col="4">Component</th>
            <th data-col="5">What</th>
            <th data-col="6">Where</th>
            <th data-col="7">Why</th>
            <th data-col="8">How To Fix</th>
          </tr></thead>
          <tbody>${debtRows}</tbody>
        </table>
      </div>
    </section>

    <!-- ═══ PLAYBOOKS ══════════════════════════════════════════════════════ -->
    <section id="playbooks">
      <h2>Domain Playbooks</h2>
      <details>
        <summary>View remediation playbooks (${result.playbooks.length} entries)</summary>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Finding</th><th>Domain</th><th>Rule</th><th>Why Priority</th><th>Fix Steps</th><th>Verification</th></tr></thead>
            <tbody>${playbookRows}</tbody>
          </table>
        </div>
      </details>
    </section>

    <!-- ═══ TREND ══════════════════════════════════════════════════════════ -->
    <section id="trend">
      <h2>Trend Delta</h2>
      <div class="trend-grid">
        <article class="card">
          <h4>Status</h4>
          <p style="font-size:15px;font-weight:700;color:var(--text);margin-top:8px">${result.trend.status}</p>
        </article>
        <article class="card">
          <h4>Score Change</h4>
          <p style="font-size:15px;margin-top:8px">
            ${result.trend.previousScore ?? "n/a"} → <strong>${result.score.overall}</strong>
            <span class="${scoreDeltaClass}" style="margin-left:8px">(${scoreDeltaStr})</span>
          </p>
        </article>
        <article class="card">
          <h4>Findings Change</h4>
          <p style="font-size:15px;margin-top:8px">
            ${result.trend.previousFindingCount ?? "n/a"} → <strong>${result.findings.length}</strong>
            <span class="${findingDeltaClass}" style="margin-left:8px">(${findingDeltaStr})</span>
          </p>
        </article>
      </div>
    </section>

    <!-- ═══ BACKLOG ═════════════════════════════════════════════════════════ -->
    <section id="backlog" style="padding-bottom:48px">
      <h2>Jira Backlog Export</h2>
      <article class="card">
        <p style="color:var(--text);font-size:15px;font-weight:700">${result.backlog.length} backlog items ready</p>
        <p style="margin-top:8px">Run with <code style="background:var(--panel);padding:2px 7px;border-radius:4px">--backlog-out ./cre-backlog.csv</code> to export a Jira-importable CSV.</p>
      </article>
    </section>
  </main>

  <script>
  (function () {
    // ── Issue table filtering ──────────────────────────────────────────────
    const table    = document.getElementById("issueTable");
    const tbody    = table.querySelector("tbody");
    const rows     = Array.from(tbody.querySelectorAll("tr"));
    const search   = document.getElementById("issueSearch");
    const sevSel   = document.getElementById("sevFilter");
    const effSel   = document.getElementById("effortFilter");
    const typeSel  = document.getElementById("typeFilter");
    const tagsEl   = document.getElementById("filterTags");
    const cntEl    = document.getElementById("visibleCount");
    let   activeCmp = null;
    const sortState = {};

    function renderTags() {
      const tags = [];
      if (activeCmp)     tags.push(tag("Component: " + activeCmp, "cmp"));
      if (sevSel.value)  tags.push(tag("Severity: " + sevSel.value, "sev"));
      if (effSel.value)  tags.push(tag("Effort: " + effSel.value, "eff"));
      if (typeSel.value) tags.push(tag("Type: " + typeSel.value, "type"));
      if (search.value)  tags.push(tag("Search: " + search.value, "srch"));
      tagsEl.innerHTML = tags.join("");
      tagsEl.querySelectorAll(".xtag").forEach(x =>
        x.addEventListener("click", () => {
          const k = x.dataset.key;
          if (k === "cmp")  { activeCmp = null; document.querySelectorAll(".comp-chip").forEach(c => c.classList.remove("active")); }
          if (k === "sev")  sevSel.value = "";
          if (k === "eff")  effSel.value = "";
          if (k === "type") typeSel.value = "";
          if (k === "srch") search.value = "";
          apply();
        })
      );
    }
    function tag(label, key) {
      return '<span class="filter-tag">' + label + ' <span class="xtag" data-key="' + key + '">×</span></span>';
    }

    function apply() {
      const q   = search.value.toLowerCase();
      const sev = sevSel.value;
      const eff = effSel.value;
      const typ = typeSel.value;
      let cnt = 0;
      rows.forEach(r => {
        const txt  = r.textContent.toLowerCase();
        const rSev = r.dataset.severity || "";
        const rCmp = r.dataset.component || "";
        const rType = r.dataset.type || "";
        const rEff = r.children[3]?.textContent?.trim() || "";
        const show =
          (!q   || txt.includes(q)) &&
          (!sev || rSev === sev) &&
          (!eff || rEff === eff) &&
          (!typ || rType === typ) &&
          (!activeCmp || rCmp === activeCmp);
        r.style.display = show ? "" : "none";
        if (show) cnt++;
      });
      if (cntEl) cntEl.textContent = cnt;
      renderTags();
    }

    search.addEventListener("input", apply);
    sevSel.addEventListener("change", apply);
    effSel.addEventListener("change", apply);
    typeSel.addEventListener("change", apply);

    document.getElementById("clearFiltersBtn").addEventListener("click", () => {
      search.value = ""; sevSel.value = ""; effSel.value = ""; typeSel.value = ""; activeCmp = null;
      document.querySelectorAll(".comp-chip").forEach(c => c.classList.remove("active"));
      apply();
    });

    // Component chip clicks
    document.querySelectorAll(".comp-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        const cmp = chip.dataset.comp;
        if (activeCmp === cmp) {
          activeCmp = null; chip.classList.remove("active");
        } else {
          activeCmp = cmp;
          document.querySelectorAll(".comp-chip").forEach(c => c.classList.remove("active"));
          chip.classList.add("active");
          document.getElementById("issues").scrollIntoView({ behavior: "smooth" });
        }
        apply();
      });
    });

    // Column sort
    table.querySelectorAll("th[data-col]").forEach(th => {
      th.addEventListener("click", () => {
        const idx = Number(th.dataset.col);
        const asc = !sortState[idx];
        sortState[idx] = asc;
        table.querySelectorAll("th").forEach(t => { const a = t.querySelector(".sarr"); if (a) a.remove(); });
        const a = document.createElement("span"); a.className = "sarr"; a.textContent = asc ? " ▲" : " ▼"; th.appendChild(a);
        rows.sort((a, b) => {
          const av = a.children[idx]?.textContent?.trim() || "";
          const bv = b.children[idx]?.textContent?.trim() || "";
          const an = Number(av), bn = Number(bv);
          const cmp = !isNaN(an) && !isNaN(bn) ? an - bn : av.localeCompare(bv);
          return asc ? cmp : -cmp;
        });
        rows.forEach(r => tbody.appendChild(r));
        apply();
      });
    });

    // CSV export (filtered rows only)
    document.getElementById("exportCsvBtn").addEventListener("click", () => {
      const vis = rows.filter(r => r.style.display !== "none");
      const hdrs = ["Severity","ID","Priority","Effort","Component","What","Where","Why","How To Fix"];
      const csv = [hdrs.join(","),
        ...vis.map(r => Array.from(r.children)
          .map(td => '"' + (td.textContent || "").replace(/"/g, '""').trim() + '"')
          .join(","))
      ].join("\\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const el = document.createElement("a");
      el.href = URL.createObjectURL(blob);
      el.download = "cre-issues.csv";
      el.click();
    });
  })();
  </script>
</body>
</html>`;
}
