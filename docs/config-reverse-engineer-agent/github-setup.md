# GitHub Repository Setup Guide

Use this guide after creating the GitHub repository (`config-reverse-engineer-agent`).

## 1) Initialize Local Git (if needed)

```bash
git init
git remote add origin <repo-url>
git add .
git commit -m "Initial commit: scaffold config reverse engineer agent"
git branch -M main
git push -u origin main
```

## 2) Branch Strategy

- `main`: protected, releasable branch
- `feature/*`: active implementation branches
- Pull requests required for all merges into `main`

PR title format:

`[W-xxxxxxx] short description`

## 3) Branch Protection Rules

Configure in GitHub UI for `main`:

- Require pull request before merge
- Require status checks to pass
- Require branch to be up to date before merge
- Restrict direct push access

## 4) Required Repository Secrets

Add in GitHub -> Settings -> Secrets and variables -> Actions:

- `SF_AUTH_URL` or JWT auth bundle values
- `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY`
- Any environment-specific callback credential

Never commit secrets into source.

## 5) CI Baseline

Workflow file: `.github/workflows/ci.yml`

Runs on pull requests to `main`:

- `npm ci`
- `npm run prettier:verify`
- `npm run lint`
- `npm test`

## 6) Team Workflow

1. Create feature branch.
2. Update `task.md` status and plan.
3. Implement and test locally.
4. Open PR using project template.
5. Merge only after required checks pass.

## 7) Deploy Only This Application

Do not deploy the entire repository metadata.

Use targeted deployment commands:

```bash
sf project deploy start --source-dir apps/config-reverse-engineer-agent/force-app --target-org <alias>
sf project deploy start --manifest manifest/config-reverse-engineer-agent/package.xml --target-org <alias>
```
