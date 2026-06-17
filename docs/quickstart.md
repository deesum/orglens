# Quickstart

This guide shows how to run `cre-agent` against your Salesforce org alias `fslspecialedition`.

## 1) Prerequisites

- Node.js 20+
- Salesforce CLI (`sf`) installed
- Salesforce Code Analyzer plugin available to `sf`
- Optional for recommendations:
  - `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY`

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
cre-agent --help
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
cre-agent analyze \
  --repo . \
  --package manifest/config-reverse-engineer-agent/package.xml \
  --target-org fslspecialedition \
  --format html \
  --mode local
```

Output file defaults to:

- `cre-report.html`

## 5) Run CI gate mode (PR threshold enforcement)

```bash
cre-agent analyze \
  --repo . \
  --target-org fslspecialedition \
  --format json \
  --mode ci \
  --threshold 70
```

Behavior:

- exits non-zero when score is below threshold
- writes JSON report (`cre-report.json` by default)

## 6) Run governance mode (scheduled snapshots)

```bash
cre-agent analyze \
  --repo . \
  --target-org fslspecialedition \
  --format md \
  --mode governance
```

Outputs:

- `cre-report.md`
- snapshot JSON files in `.cre-snapshots/`

## 7) Pick LLM provider (optional)

```bash
cre-agent analyze --repo . --target-org fslspecialedition --format md --provider openai
cre-agent analyze --repo . --target-org fslspecialedition --format md --provider anthropic
```

## 8) Typical execution pattern for architects

1. Run local HTML report.
2. Review Health Score and confidence.
3. Review top 10 debt findings with fix-now rationale.
4. Review recommendations and verify evidence finding IDs.
5. Export JSON/MD for backlog and governance tracking.

## 9) Export Jira-ready backlog

```bash
cre-agent analyze \
  --repo . \
  --package manifest/config-reverse-engineer-agent/package.xml \
  --target-org fslspecialedition \
  --format html \
  --team "FSL-Architecture" \
  --release-train "R2" \
  --backlog-out "./cre-backlog.csv"
```

The generated CSV includes key, summary, severity, effort, owner team, release train, and recommendation fields for backlog import.
