# Changelog

All notable changes to OrgLens are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Changed
- Rebranded the project to **OrgLens**; CLI command is now `orglens`.
- Default report/backlog filenames are now `orglens-report.*` / `orglens-backlog.csv`.

### Added
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
