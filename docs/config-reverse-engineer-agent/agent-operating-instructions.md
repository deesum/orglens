# Agent Operating Instructions

This repository uses a strict Salesforce-oriented execution process for AI agents and human contributors.

## 1) State Machine (Mandatory)

Track work using these states:

- `IDLE`
- `ANALYZE`
- `PLAN`
- `DEVELOP`
- `DEBUG`
- `ARCHITECT`

State transitions:

- New feature/story -> `ANALYZE`
- Bug report/incident -> `DEBUG`
- Major redesign/refactor -> `ARCHITECT`
- Clear requirements -> `PLAN`
- Approved plan -> `DEVELOP`
- Found defect while developing -> `DEBUG`
- Definition of Done met -> `IDLE`

## 2) Update `task.md` In Every State

On each state transition, update `task.md` with:

- Current status and date
- Analysis details (requirements, dependencies, risks)
- Plan phases and affected files
- Debug section when relevant (5+ hypotheses minimum)
- Decisions and reference docs

Do not skip this step.

## 3) Salesforce Engineering Rules

- Prefer standard objects before custom objects.
- Prefer declarative-first implementation when feasible.
- Prefer LWC over Aura.
- Prefer UI API/LDS before writing Apex for UI use cases.
- Enforce CRUD/FLS and sharing for server logic.
- Avoid SOQL/DML in loops; bulkify all Apex.
- No hardcoded secrets, IDs, or user-facing strings.
- LWC must avoid `innerHTML`/`eval` and follow SLDS patterns.
- Design for offline-safe behavior where Field Service Mobile is in scope.

## 4) Quality Gate (Definition of Done)

Before marking work complete:

- Lint/format clean.
- Tests pass (Apex target >= 85% coverage where Apex changes are included).
- Security checks pass (no secrets, input validation present, CRUD/FLS respected).
- Docs updated (`README`, architecture notes, and `task.md`).
- PR includes rollout and risk notes.

## 5) Config Reverse Engineer Agent Scope

The target solution has two install/deploy surfaces:

1. Salesforce package (installable in multiple orgs)
   - UI/dashboard
   - Configuration and credentials setup
   - Job/result metadata model
2. External analysis service
   - Retrieves/scans metadata
   - Runs Salesforce Code Analyzer
   - Uses LLM provider for prioritization summary
   - Sends normalized findings back to Salesforce

## 6) GitHub Workflow Standards

- Branch strategy: `main` + `feature/*`.
- PR title convention: `[W-xxxxxxx] short description`.
- Direct push to `main` is discouraged; use PR flow.
- Keep secrets in GitHub Secrets and Salesforce credentials, never in source.
- CI must run lint/format verification and unit tests on pull requests.

## 7) Required Repo Files

Maintain and keep current:

- `task.md`
- `README.md`
- `docs/config-reverse-engineer-agent/architecture.md`
- `docs/config-reverse-engineer-agent/github-setup.md`
- `.github/pull_request_template.md`
- `.github/ISSUE_TEMPLATE/*`
- `.github/workflows/ci.yml`

## 8) Execution Notes for Agents

- Read this file and `task.md` before making changes.
- If requirements are ambiguous, ask clarifying questions before implementation.
- Keep changes scoped; avoid unrelated refactors.
- If unexpected unrelated diffs appear, stop and ask the user how to proceed.
