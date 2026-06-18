# Changelog

All notable changes to OrgLens are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Changed

- Rebranded the project to **OrgLens**; CLI command is now `orglens`.
- Default report/backlog filenames are now `orglens-report.*` / `orglens-backlog.csv`.
- Repository moved to `github.com/deesum/orglens`.
- Backlog keys are now `ORGLENS-*` and the CSV gained an `Owner` column.

### Added

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
