# Quickstart

This guide shows how to run `orglens` against your Salesforce org alias `fslspecialedition`.

## 1) Prerequisites

- Node.js 20+
- Salesforce CLI (`sf`) installed
- Salesforce Code Analyzer **v5** plugin available to `sf`
  (`sf plugins install code-analyzer`)
- A JDK 11+ for PMD / Graph Engine / CPD (`brew install openjdk@17`) — OrgLens
  auto-detects it; no `JAVA_HOME`/`PATH` setup required
- Optional extra engines (light up automatically when installed):
  - `brew install semgrep` (SAST), `brew install gitleaks` (secrets);
    npm audit ships with Node.js
- Optional for recommendations:
  - `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY`

List all engines and rules (and confirm the detected JDK):

```bash
orglens rules
```

## 2) Install and link the CLI locally

From the repository root:

```bash
cd "/Users/dsumra/Documents/VSCodeProjects/fslspecialedition/config-reverse-engineer-agent"
npm install
npm run build
npm link
```

Verify:

```bash
orglens --help
```

## 3) Authenticate Salesforce CLI (org alias)

If your alias is not already authenticated:

```bash
sf org login web --alias fslspecialedition
```

Confirm:

```bash
sf org list
```

## 4) Run local architect mode (HTML report)

```bash
orglens analyze \
  --repo . \
  --package manifest/config-reverse-engineer-agent/package.xml \
  --target-org fslspecialedition \
  --format html \
  --mode local
```

Output file defaults to:

- `orglens-report.html`

Minimal run (no package, no org alias):

```bash
orglens analyze --repo . --format html --mode local
```

## 5) Run CI gate mode (PR threshold enforcement)

```bash
orglens analyze \
  --repo . \
  --target-org fslspecialedition \
  --format json \
  --mode ci \
  --threshold 70
```

Behavior:

- exits non-zero when score is below threshold
- writes JSON report (`orglens-report.json` by default)

## 6) Run governance mode (scheduled snapshots)

```bash
orglens analyze \
  --repo . \
  --target-org fslspecialedition \
  --format md \
  --mode governance
```

Outputs:

- `orglens-report.md`
- snapshot JSON files in `.cre-snapshots/`

## 7) Pick LLM provider (optional)

```bash
orglens analyze --repo . --target-org fslspecialedition --format md --provider openai
orglens analyze --repo . --target-org fslspecialedition --format md --provider anthropic
```

## 8) Typical execution pattern for architects

1. Run local HTML report.
2. Review Health Score and confidence.
3. Review top 10 debt findings with fix-now rationale.
4. Review recommendations and verify evidence finding IDs.
5. Export JSON/MD for backlog and governance tracking.

## 10) Browser UI (minimal input)

```bash
orglens ui --repo "/Users/dsumra/Documents/VSCodeProjects/fslspecialedition/fslspecialedition" --port 4173
```

Then open `http://127.0.0.1:4173`, load components, click **Load Rules &
Engines** to choose engines/rules and override severities, then **Run Scanner**.

> If the UI looks stale after rebuilding, stop the old server
> (`pkill -f "dist/cli.js ui"`), rebuild, restart, and hard refresh the browser.

## 9) Export Jira-ready backlog

```bash
orglens analyze \
  --repo . \
  --package manifest/config-reverse-engineer-agent/package.xml \
  --target-org fslspecialedition \
  --format html \
  --team "FSL-Architecture" \
  --release-train "R2" \
  --backlog-out "./orglens-backlog.csv"
```

The generated CSV includes key, summary, severity, effort, owner team, release train, and recommendation fields for backlog import.
