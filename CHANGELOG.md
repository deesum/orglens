# Changelog

All notable changes to OrgLens are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [0.3.0] - 2026-06-22

### Changed

- **Migrated to Salesforce Code Analyzer v5** (`sf code-analyzer run` / `rules`).
  Engines are now PMD, ESLint, RetireJS, Regex, Copy/Paste Detector, Salesforce
  Graph Engine, and Flow (700+ rules vs. ~220 on v4). Install with
  `sf plugins install code-analyzer`; the legacy `sfdx-scanner` v4 plugin is no
  longer required.
- **Documentation links for every engine** — rule doc URLs now come straight
  from the engine's own `resources` metadata, so findings deep-link to the exact
  rule page (PMD, ESLint, RetireJS, CPD, SFGE all covered). Engine-aware
  fallbacks cover the few rules without a resource URL (regex, scoped ESLint
  plugin rules) instead of returning a generic search link.

### Added

- **Pluggable scanner adapters** — a `ScannerAdapter` interface lets external
  tools plug into OrgLens. Each adapter contributes normalized findings to the
  **single combined Health Score** and appears in the same Engines panel with
  live install status and install directions. Ships with three adapters:
  - **Semgrep** — fast SAST (community/custom rules) for JS/TS/Apex; set
    `ORGLENS_SEMGREP_CONFIG` to use a local ruleset offline.
  - **Gitleaks** — secret scanning (hardcoded keys/tokens/credentials).
  - **npm audit** — dependency CVEs for Node projects (auto-skips when there is
    no `package.json`/lockfile).
  - Adding more tools (Snyk, CodeQL, SonarQube, OWASP Dependency-Check, ...) is
    now a single file implementing the interface plus a registry entry.
- `engine` field on each finding records which scan engine produced it; the
  scanner message now summarizes per-engine outcomes (ok / skipped / failed).
- Engine selection (`--engines`, UI checkboxes) now covers adapter engines too;
  unavailable tools are skipped gracefully without failing the run.

## [0.2.0] - 2026-06-19

### Fixed

- **Blank report preview in the UI** — the iframe now clears `srcdoc` before
  setting `src` (browsers give `srcdoc` precedence) and appends a cache-buster so
  re-runs always reload. Added an "Open full report in new tab" link and
  load/error status feedback.

### Changed

- Rebranded the project to **OrgLens**; CLI command is now `orglens`.
- Default report/backlog filenames are now `orglens-report.*` / `orglens-backlog.csv`.
- Repository moved to `github.com/deesum/orglens`.
- Backlog keys are now `ORGLENS-*` and the CSV gained an `Owner` column.

### Added

- **Automatic Java detection** — OrgLens now locates an installed JDK (Homebrew,
  system JVMs, SDKMAN) and runs the real Salesforce Code Analyzer even when
  macOS's `/usr/bin/java` stub would block it. The lightweight fallback is only
  used when no JDK is present.
- **Engine awareness** — `orglens rules` and the UI now show every scan engine
  (PMD, ESLint, ESLint-TypeScript, RetireJS, Salesforce Graph Engine, plus the
  built-in lightweight engine) with install status and directions. New
  `--engines` analyze flag (and UI engine checkboxes) choose which engines run.
- **Full rule catalog** — `orglens rules` now lists *all* rules available across
  installed engines (200+), not just the rules that fired, each with default
  severity and category. The UI Rules panel loads the full catalog with an
  engine filter, apply toggles, severity overrides, and per-rule docs links.
- **Rule management** — rules can be disabled or re-prioritized via
  `--disable-rules` / `--severity-overrides` CLI flags, the `ruleOverrides`
  config block, or the interactive Rules panel in the UI.
- **Scoring Guide** — a built-in explainer (HTML report section + collapsible UI
  help) describing the Health Score, letter grade, category breakdown, severity
  points, confidence, blast radius, and priority.
- **MIT License** — project is now open source.
- **Letter grade (A–F)** scorecard alongside the numeric Health Score.
- **What-If Simulator** — projected score lift per rule / component / severity group.
- **Remediation Roadmap** — effort-weighted sprint plan with cumulative projected scores.
- **Ownership** mapping via configurable path-glob rules (`ownership.rules`).
- **Score history sparkline** built from governance snapshots.
- **Save as PDF** button + print-optimized stylesheet in the HTML report.
- `orglens diff` — compare two reports (introduced vs resolved findings).
- `orglens ask` — natural-language Q&A over a report via OpenAI/Anthropic.
- `analyze --summary-out` — compact Markdown summary for PR comments.
- `analyze --create-jira` / `--jira-execute` — create Jira issues via REST (dry run by default).
- GitHub Action `orglens-health.yml` with a PR comment bot.
- `roadmap` and `ownership` config blocks (+ example config).
- `CONTRIBUTING.md` and this `CHANGELOG.md`.
- `package.json` metadata: keywords, author, `files`, `engines`, `prepublishOnly`.

## [0.1.0] — Initial

### Added

- Salesforce Code Analyzer (PMD + ESLint) integration with a Java-free
  lightweight fallback scanner.
- Metadata discovery for Apex, LWC, Flow, Aura, Custom Objects/Fields,
  Permission Sets, Flexipages, Custom Labels, Static Resources, Visualforce.
- Dependency graph with blast-radius impact scoring.
- Weighted Health Score with category breakdown and confidence metric.
- Priority ranking (severity × blast radius × effort).
- AI (OpenAI/Anthropic) and heuristic remediation recommendations.
- Interactive HTML report: severity distribution, score breakdown, component
  hotspot chips, Quick Wins, rule documentation deep links, multi-filtering,
  sortable table, and CSV export.
- Per-violation documentation deep links (uses scanner-provided URLs).
- Domain playbooks, trend delta vs. snapshots, and Jira-ready CSV backlog.
- Run modes: local, CI gate, and governance.
- Local browser UI for point-and-click scoped scans.
- JSON / Markdown / HTML output formats.
