# Contributing to OrgLens

Thanks for your interest in improving **OrgLens** — the AI-powered Salesforce
metadata health and tech-debt analyzer.

## Getting set up

```bash
git clone https://github.com/deesum/orglens.git
cd orglens
npm install
npm run build
npm link        # makes the `orglens` command available locally
```

See the [README](./README.md) for full prerequisites (Node 20+, Java/JDK 17,
Salesforce CLI + Code Analyzer plugin).

## Development workflow

| Task            | Command                                |
| --------------- | -------------------------------------- |
| Build           | `npm run build`                        |
| Lint            | `npm run lint`                         |
| Unit tests      | `npm test`                             |
| Format          | `npm run format`                       |
| Run from source | `npm run dev -- analyze --repo <path>` |

Before opening a pull request, please ensure:

- `npm run lint` passes
- `npm test` passes
- `npm run build` succeeds
- New behavior has appropriate test coverage where practical

## Project layout

```
src/
  cli.ts            # CLI entrypoint (commander)
  commands/         # analyze orchestration
  scanner/          # Code Analyzer runner + fallback scanner + normalization
  parser/           # metadata discovery (Apex/LWC/Flow/catalog) + package.xml scope
  deps/             # dependency graph + blast-radius impact
  scoring/          # health score + confidence
  ranking/          # priority ranking
  llm/              # provider clients + prompts + validation
  report/           # HTML/Markdown/JSON renderers + rule docs + playbooks
  modes/            # CI gate + governance snapshots + trend delta
  ui/               # local web UI server
  utils/            # shared utilities
```

## Commit messages

Use concise, imperative summaries describing the "why" (e.g.
`Add metadata-type filter to issues table`). Group related changes per commit.

## Reporting issues

Open an issue with reproduction steps, the command you ran, environment
(`node -v`, `java -version`, `sf --version`), and expected vs. actual behavior.
