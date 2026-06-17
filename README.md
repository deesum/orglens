# Config Reverse Engineer Agent

CLI for analyzing Salesforce metadata health, ranking debt priorities, and generating evidence-linked recommendations.

## Dependencies

Required:

- Node.js 20+
- Salesforce CLI (`sf`)
- Salesforce Code Analyzer plugin (`@salesforce/sfdx-scanner`)
- Java Runtime (JDK 17 recommended)

Optional (for recommendation generation):

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`

### Install dependencies

```bash
# Salesforce scanner plugin
sf plugins install @salesforce/sfdx-scanner

# Java (macOS/Homebrew)
brew install openjdk@17
sudo ln -sfn /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-17.jdk
echo 'export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Verify dependencies

```bash
node -v
sf --version
sf plugins | rg sfdx-scanner
java -version
```

## Installation

```bash
npm install
npm run build
npm link
```

Global install (when published):

```bash
npm i -g config-reverse-engineer
```

Quickstart for your org alias (`fslspecialedition`):

- `docs/quickstart.md`

## Usage Modes

### Local architect mode

Run one-off assessment from repo/package:

```bash
cre-agent analyze --repo . --package manifest/config-reverse-engineer-agent/package.xml --target-org myorg --format html --mode local
```

### CI gate mode

Use in PR checks and fail or warn when score drops:

```bash
cre-agent analyze --repo . --format json --mode ci --threshold 70
```

### Program governance mode

Schedule daily/weekly and persist snapshots:

```bash
cre-agent analyze --repo . --format md --mode governance
```

## What You Receive

- Overall Health Score
- Top 10 prioritized debt findings with "fix now" rationale
- Dependency impact graph summary
- Human-readable recommendations with finding evidence IDs
- Exportable JSON/Markdown/HTML artifacts

## Example User Journey

```bash
sf org login web
cre-agent analyze --repo . --package package.xml --target-org myorg --format html
```

## Deploy (Salesforce Metadata Only)

Use targeted deploy commands only:

```bash
sf project deploy start --source-dir apps/config-reverse-engineer-agent/force-app --target-org <alias>
sf project deploy start --manifest manifest/config-reverse-engineer-agent/package.xml --target-org <alias>
```
