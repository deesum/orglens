# Config Reverse Engineer Agent Architecture

## Solution Shape

The solution is split into two deployable surfaces:

1. Salesforce package (installable in target orgs)
2. External analysis service (hosted outside Salesforce runtime)

## Why External Service

Salesforce runtime (Apex/Flow) cannot natively execute CLI-based static analysis at scale. The external service handles long-running analysis and LLM calls, while Salesforce hosts UX and governance records.

## Core Components

### Salesforce Package

- Setup application/tab for admin configuration
- Metadata objects for:
  - scan jobs
  - findings
  - score snapshots
- LWC dashboards and drill-down views
- Permission sets and access controls
- Named Credential integration to external API

### External Analysis Service

- Job intake API
- Metadata retrieval/parsing module
- Salesforce Code Analyzer wrapper
- Dependency graph engine
- Scoring/prioritization engine
- LLM summarization adapter (OpenAI/Anthropic)
- Callback publisher to Salesforce

## Data Flow

1. User initiates scan from Salesforce.
2. Salesforce creates job record and calls external service.
3. External service scans metadata and computes score/findings.
4. External service posts normalized results to Salesforce.
5. Salesforce dashboard displays trends and prioritized debt.

## Packaging Strategy

- Recommended baseline: unlocked package for internal enterprise rollout.
- Optional later: managed package path for ISV/AppExchange distribution.
- External service remains separately deployed and configured per tenant.

## Security Considerations

- Store API keys and certificates in secret managers, not source control.
- Enforce tenant/org isolation in external processing.
- Sign and authenticate callbacks from service to Salesforce.
- Mask sensitive metadata snippets before sending to third-party LLMs.
