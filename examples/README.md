# OrgLens — Example Input & Output

This folder contains a real sample run so you can see what OrgLens produces
without installing anything.

## Input

A standard Salesforce DX project (the bundled vegetation-management demo app).
OrgLens was pointed at the project root and auto-detected the metadata under
`force-app/main/default`:

```bash
orglens analyze --repo ./my-sfdx-project --format html
```

No `package.xml` or org connection is required — just a path.

## Output files

| File | What it is |
| --- | --- |
| [`sample-report.html`](./sample-report.html) | Interactive dashboard: Grade, Health Score, severity distribution, Rule Summary (with rule-doc deep links), Recommendations, Quick Wins, What-If Simulator, Remediation Roadmap, All Issues, Ownership, Trend, Backlog. Includes a **Save as PDF** button. |
| [`sample-report.json`](./sample-report.json) | Full machine-readable result (used by `orglens diff` and `orglens ask`). |
| [`sample-summary.md`](./sample-summary.md) | Compact Markdown summary used for CI / pull-request comments. |
| [`sample-backlog.csv`](./sample-backlog.csv) | Jira-ready backlog export (severity, effort, owner, recommendation). |

## View the HTML report rendered

GitHub shows `.html` as source. To see it rendered, open it through a static
HTML viewer:

```
https://raw.githack.com/deesum/orglens/main/examples/sample-report.html
```

(or download `sample-report.html` and open it in any browser).

## Note on coverage

This sample was generated in an environment **without** the Java-based Salesforce
Code Analyzer, so OrgLens used its lightweight fallback scanner (fewer findings,
lower confidence). With Java + the Code Analyzer plugin installed, the same
report surfaces the full PMD + ESLint rule set — typically thousands of findings
on a large org, which makes the What-If Simulator, Roadmap, and Ownership
sections far richer.
