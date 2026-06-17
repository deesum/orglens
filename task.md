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
- Hypotheses (5+):
- Root cause:
- Fix:
- Verify:
- Governor Limits Check:

## Decisions / Links
- ADRs / Notes:
  - Use targeted deployments only.
  - Use deterministic scoring and evidence-bound recommendations.
  - Added value upgrades: domain playbooks, trend delta analytics, and Jira-ready backlog export.
  - Added Java-unavailable fallback scanner so restricted runtimes still generate actionable findings.
- Reference Docs: `docs/config-reverse-engineer-agent/architecture.md`
