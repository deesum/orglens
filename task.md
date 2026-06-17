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
- Governor Limits Check:

## Decisions / Links
- ADRs / Notes:
  - Use targeted deployments only.
  - Use deterministic scoring and evidence-bound recommendations.
  - Added value upgrades: domain playbooks, trend delta analytics, and Jira-ready backlog export.
  - Added Java-unavailable fallback scanner so restricted runtimes still generate actionable findings.
- Reference Docs: `docs/config-reverse-engineer-agent/architecture.md`
