# [W-003] Config Reverse Engineer Agent Setup Status:Develop Date: 2026-06-17

## Analysis

- Reqs:
  - Implement CLI tool that computes score + priority ranking.
  - Generate evidence-linked human-readable recommendations.
  - Support local, CI gate, and governance modes.
- Clarifications (<=6):
  - Runtime: Node.js + TypeScript.
  - LLM providers: OpenAI + Anthropic in MVP.
- Risks/Dependencies:
  - Scanner output variability between CLI versions.
  - LLM response non-determinism mitigated with strict JSON + evidence validation.
  - CI gate thresholds need team policy tuning.
- Standard Objects Evaluation:
  - N/A (tooling-only task; no new Salesforce object introduced in MVP scaffold).

## Plan

- Phases/Tasks (Est, Files):
  - CLI/config bootstrap complete:
    - `src/cli.ts`, `src/config/*`, `agent.config.example.yml`, `package.json`, `tsconfig.json`
  - Scanner/parser/graph scaffold complete:
    - `src/scanner/*`, `src/parser/*`, `src/deps/*`
  - Score/ranking/recommendation scaffold complete:
    - `src/scoring/*`, `src/ranking/*`, `src/llm/*`, `src/rules/*`
  - Modes/reporting scaffold complete:
    - `src/report/*`, `src/modes/*`
  - Packaging/CI updates in progress:
    - `.github/workflows/ci.yml`, `README.md`, tests
- Components: [CLI|Parser|Scoring|LLM|Reporting|CI]
- Data Model: Findings + dependency nodes/edges + score/ranking DTOs in `src/types/models.ts`

## Debug (if applicable)

- Symptoms:
  - HTML debt table first row intermittently appeared blank in "Finding" column.
  - Full absolute file paths made the debt table hard to scan in large org repos.
  - Selecting metadata types did not automatically select related component names.
  - Large org runs appeared "limited" because only top 10 debts were retained in pipeline.
- Hypotheses (5+):
  - Finding IDs can be missing/empty in some scanner-normalized rows.
  - UI and HTML renderer lacked fallback display for empty IDs.
  - Paths are rendered directly from scanner output without compaction.
  - Analyze command truncated ranked debts too early (`slice(0, 10)`).
  - Type-checkbox events were only filtering visibility, not propagating selection state.
- Root cause:
  - Combined UX + logic constraints: strict top-10 truncation, verbose path rendering, and no type-to-component auto-select synchronization.
- Fix:
  - Keep full ranked debt list in `analyze` and render top 50 in HTML with total count context.
  - Compact displayed paths to trailing segments (`.../a/b/c/file`) for readability.
  - Add fallback finding ID (`finding-N`) if source ID is empty.
  - Auto-select/deselect component names when component type toggles change in UI.
  - Improve debt table visual hierarchy (table wrapper + alternating rows + clearer path styling).
- Verify:
  - Build/lint/test locally after patch.
  - Run UI against large repo path and validate count, row IDs, auto-selection behavior, and compact paths.
  - Validate embedded preview (`127.0.0.1`) and direct file render use the same generated report file path.
  - Validate recommendations and rule summary no longer show full absolute paths.
- Governor Limits Check:

## Decisions / Links

- ADRs / Notes:
  - Use targeted deployments only.
  - Use deterministic scoring and evidence-bound recommendations.
  - Added value upgrades: domain playbooks, trend delta analytics, and Jira-ready backlog export.
  - Added Java-unavailable fallback scanner so restricted runtimes still generate actionable findings.
  - Added rule documentation deep links (`src/report/ruleDocs.ts`): PMD Apex category pages, ESLint rule pages, LWC eslint plugin docs.
  - Added architect/team report features: Quick Wins (high-severity + low-effort), metadata-type filter, rule reference column, severity distribution, score breakdown, component hotspot chips, and CSV export.
  - Discovered Salesforce Code Analyzer emits an exact per-violation `url`; now captured end-to-end (`AnalyzerFinding.url`) and preferred over the heuristic map so links point to the specific failing rule anchor (version-matched).
  - Comprehensive PMD Apex rule->category map added as fallback for the lightweight scanner.
  - Rewrote README.md as a complete first-time-user guide (audience, value, prerequisites + install steps, tool install, CLI/UI usage, features, modes, troubleshooting, command reference).
  - Rebranded to OrgLens (CLI `orglens`); added package.json metadata, CONTRIBUTING.md, CHANGELOG.md; license held as UNLICENSED pending policy confirmation.
  - Added architect/team feature set: letter grade (A–F), What-If simulator (score lift by rule/component/severity), effort-weighted remediation roadmap (sprint planner with projected scores), ownership mapping via path-glob config, score-history sparkline, Save-as-PDF/print CSS, `orglens diff`, `orglens ask`, `--summary-out` for PR comments, Jira REST creation (`--create-jira`/`--jira-execute`, dry-run default), and a GitHub Action PR comment bot. Repo remote moved to github.com/deesum/orglens.
  - Added rule management + scoring transparency: `ruleOverrides` config block (disabled list + per-rule severity), `src/rules/ruleOverrides.ts` (resolveRuleOverrides, applyRuleOverrides, buildRuleCatalog), `orglens rules` command (+ `/api/rules` UI endpoint), analyze flags `--disable-rules`/`--severity-overrides`, an interactive UI Rules panel (toggle apply, override severity, filter, per-rule docs link), and a Scoring Guide explainer in both the HTML report and the UI. Unit tests in `src/__tests__/ruleOverrides.test.ts` (22 tests passing).
  - ROOT CAUSE of "scanner always falls back": macOS `/usr/bin/java` stub shadows the real Homebrew JDK, so Salesforce Code Analyzer failed Java detection. Fixed via `src/utils/javaHome.ts` (resolveJavaHome + javaAwareEnv) which probes JAVA_HOME, `/usr/libexec/java_home`, Homebrew (`/opt/homebrew/opt/openjdk*`), `/Library/Java/JavaVirtualMachines`, `/usr/lib/jvm`, and SDKMAN, then injects JAVA_HOME/PATH into the scanner spawn. Verified the real PMD engine now runs (engine="pmd") instead of the lightweight fallback.
  - Added full engine/rule catalog: `src/scanner/ruleCatalog.ts` (`listAvailableRules`) lists ALL rules across installed engines via `sf scanner rule list --json` (220 rules: pmd 67, eslint 59, eslint-typescript 81, retire-js 1, sfge 8, orglens-lite 4), with engine availability + install hints (scanner not installed / needs Java). `orglens rules` now lists engines + all rules (no --repo). Added `--engines` analyze flag and `runCodeAnalyzer({engines})` passing `--engine` to the scanner.
  - UI: new engines panel (status badges + install directions + run checkboxes), rules panel now loads the full catalog with an engine filter and engine column; component selection decluttered (Load button inline, removed redundant "Selected components" section).
  - Docs: added real UI screenshots under docs/screenshots/ (captured via headless Chrome + puppeteer-core against the live UI); embedded in README, refreshed README UI/Java/Troubleshooting sections, and updated docs/quickstart.md for engines/rules + Java auto-detection.
  - Released v0.2.0 (CHANGELOG `[0.2.0]`, package.json + cli.ts bumped, tag + GitHub release marked Latest). Fixed contributor attribution: stripped `Co-authored-by: Cursor` trailers from all commit messages via `git filter-branch --msg-filter` and re-authored to deepakasumra@gmail.com, force-pushed main + tags. Remaining `cursoragent` entry is GitHub's cached contributor graph (no commit references it anymore).
  - Added **pluggable scanner adapter** framework so additional tools normalize into one combined Health Score and appear in the same Engines panel:
    - `src/scanner/adapters/types.ts` (`ScannerAdapter` interface: detect/isApplicable/run/rules), `src/scanner/adapters/util.ts` (`toolAvailable`, `buildFinding`), `src/scanner/adapters/registry.ts` (ADAPTERS list + `adapterEngineInfos`/`adapterRules`).
    - Adapters: `semgrep.ts` (SAST, `semgrep scan --json --config auto`, ERROR/WARNING/INFO→sev), `gitleaks.ts` (secrets, `gitleaks detect --no-git --report-format json`, all critical), `npmAudit.ts` (dependency CVEs, `npm audit --json`, gated on package.json + lockfile).
    - `src/scanner/runScanners.ts` (`runAllScanners`) merges SF Code Analyzer (+ lite fallback) + selected/available adapters into one `CombinedScanResult` with per-engine status; wired into `analyze.ts`. `src/scanner/engines.ts` (`SF_ENGINE_IDS`, `isSfEngine`) separates SF vs adapter selection.
    - `src/scanner/inferMetadata.ts` extracted shared path→metadata inference (used by normalizeFindings + adapters); added optional `engine` field to `AnalyzerFinding`.
    - ruleCatalog now merges adapter engines + representative rules so `orglens rules` / `/api/rules` / UI Engines panel show Semgrep/Gitleaks/npm-audit with install status. UI defaults + `--engines` selection already cover adapters (no UI change needed).
    - Tests: `src/__tests__/adapters.test.ts` (engine classification, metadata inference, registry/catalog, npm-audit applicability). 29 tests passing; build + lint clean.
  - Migrated to **Salesforce Code Analyzer v5** (`sf code-analyzer run`/`rules`, plugin code-analyzer 5.13.0). Rewrote `codeAnalyzerRunner.ts` (v5 JSON: `violations[]` with `rule`/`engine`/`severity` 1-5/`tags`/`locations[]`/`resources[]`; `--workspace . --rule-selector <engine|Recommended> --output-file`) and `ruleCatalog.ts` (`code-analyzer rules -r all`; engines pmd/eslint/retire-js/regex/cpd/sfge/flow; severity from number, category from tags). Updated `engines.ts` SF_ENGINE_IDS. Deleted orphaned `normalizeFindings.ts`. `orglens rules` now shows 715 rules across 10 engines.
  - **Doc links for all engines**: capture each violation/rule's `resources[]` URL (deep-links to exact rule); coverage pmd 133/133, eslint 512/542, retire-js/cpd/sfge 100%. Made `ruleDocUrl` engine-aware (`ENGINE_DOCS` map) so regex + scoped ESLint plugin rules fall back to the Code Analyzer engine guide instead of a Google search. Verified end-to-end: 118 findings across regex/eslint/pmd/cpd/flow, 118/118 with URLs.
  - Installed Semgrep 1.167.0 + Gitleaks 8.30.1 (brew); all 10 engines now report Installed. Captured fresh UI screenshots (overview, rules-panel showing 10 Installed engines + 715 rules + Java path, report-preview with multi-engine scanner KPI) via puppeteer-core/headless Chrome; removed stale orglens-engines-rules.png. 36 tests passing; build + lint clean.
- Reference Docs: `docs/config-reverse-engineer-agent/architecture.md`
