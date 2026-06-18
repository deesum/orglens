import { BacklogItem } from "../types/models.js";

export interface JiraOptions {
  execute: boolean;
  maxIssues?: number;
}

export interface JiraResult {
  attempted: number;
  created: string[];
  skipped: number;
  dryRun: boolean;
  messages: string[];
}

interface JiraEnv {
  baseUrl: string;
  email: string;
  token: string;
  projectKey: string;
  issueType: string;
}

function readEnv(): { env?: JiraEnv; missing: string[] } {
  const baseUrl = process.env.JIRA_BASE_URL;
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  const projectKey = process.env.JIRA_PROJECT_KEY;
  const issueType = process.env.JIRA_ISSUE_TYPE ?? "Task";
  const missing: string[] = [];
  if (!baseUrl) missing.push("JIRA_BASE_URL");
  if (!email) missing.push("JIRA_EMAIL");
  if (!token) missing.push("JIRA_API_TOKEN");
  if (!projectKey) missing.push("JIRA_PROJECT_KEY");
  if (missing.length > 0) return { missing };
  return {
    env: {
      baseUrl: baseUrl!,
      email: email!,
      token: token!,
      projectKey: projectKey!,
      issueType,
    },
    missing: [],
  };
}

function toAdf(text: string): unknown {
  return {
    type: "doc",
    version: 1,
    content: [
      { type: "paragraph", content: [{ type: "text", text: text || " " }] },
    ],
  };
}

/**
 * Creates Jira issues from backlog items. Defaults to a non-destructive dry run;
 * pass `execute: true` (and the JIRA_* env vars) to actually create tickets.
 */
export async function createJiraIssues(
  backlog: BacklogItem[],
  opts: JiraOptions,
): Promise<JiraResult> {
  const limit = opts.maxIssues ?? 25;
  const items = backlog.slice(0, limit);
  const result: JiraResult = {
    attempted: items.length,
    created: [],
    skipped: backlog.length - items.length,
    dryRun: !opts.execute,
    messages: [],
  };

  const { env, missing } = readEnv();

  if (!opts.execute) {
    result.messages.push(
      `Dry run: would create ${items.length} Jira issue(s)` +
        (env
          ? ` in project ${env.projectKey}.`
          : ". Set JIRA_* env vars and pass --jira-execute to create."),
    );
    for (const item of items) {
      result.messages.push(
        `  • [${item.severity}/${item.effort}] ${item.title}`,
      );
    }
    return result;
  }

  if (!env) {
    result.messages.push(
      `Cannot create issues — missing env vars: ${missing.join(", ")}.`,
    );
    return result;
  }

  const auth = Buffer.from(`${env.email}:${env.token}`).toString("base64");
  for (const item of items) {
    try {
      const response = await fetch(
        `${env.baseUrl.replace(/\/$/, "")}/rest/api/3/issue`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            fields: {
              project: { key: env.projectKey },
              issuetype: { name: env.issueType },
              summary: item.title.slice(0, 254),
              description: toAdf(
                `${item.description}\n\nRecommendation: ${item.recommendation}\n\nComponent: ${item.componentPath}`,
              ),
              labels: item.jiraLabels.map((l) => l.replace(/[^\w-]/g, "-")),
            },
          }),
        },
      );
      if (!response.ok) {
        const body = await response.text();
        result.messages.push(
          `Failed (${response.status}) for "${item.title}": ${body.slice(0, 160)}`,
        );
        continue;
      }
      const data = (await response.json()) as { key?: string };
      if (data.key) {
        result.created.push(data.key);
        result.messages.push(`Created ${data.key}: ${item.title}`);
      }
    } catch (error) {
      result.messages.push(`Error creating "${item.title}": ${error}`);
    }
  }
  return result;
}
