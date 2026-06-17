#!/usr/bin/env node
import { Command } from "commander";
import { analyzeCommand } from "./commands/analyze.js";
import { MetadataType, OutputFormat, RunMode } from "./types/models.js";
import { startUiServer } from "./ui/server.js";

const program = new Command();

program
  .name("cre-agent")
  .description("Config Reverse Engineer CLI for Salesforce metadata health analysis")
  .version("0.1.0");

program
  .command("analyze")
  .description("Analyze package.xml/repository metadata and generate debt report")
  .requiredOption("--repo <path>", "Repository root path")
  .option("--package <path>", "Path to package.xml")
  .option("--target-org <alias>", "Salesforce org alias")
  .option("--format <format>", "Output format: json|md|html", "html")
  .option("--out <path>", "Output file path")
  .option("--mode <mode>", "Run mode: local|ci|governance", "local")
  .option("--config <path>", "Path to agent config YAML")
  .option("--provider <provider>", "LLM provider: openai|anthropic")
  .option("--threshold <number>", "CI fail threshold")
  .option("--team <name>", "Owner team label for backlog export", "Architecture")
  .option("--release-train <name>", "Release train label for backlog export", "R1")
  .option("--backlog-out <path>", "CSV output path for Jira-ready backlog export")
  .option("--component-types <types>", "Comma-separated component types (ApexClass,LightningComponentBundle,Flow)")
  .option("--components <names>", "Comma-separated component names to include")
  .action(async (opts) => {
    await analyzeCommand({
      repo: opts.repo,
      packagePath: opts.package,
      targetOrg: opts.targetOrg,
      format: opts.format as OutputFormat,
      out: opts.out,
      mode: opts.mode as RunMode,
      configPath: opts.config,
      provider: opts.provider,
      threshold: opts.threshold ? Number(opts.threshold) : undefined,
      team: opts.team,
      releaseTrain: opts.releaseTrain,
      backlogOut: opts.backlogOut,
      componentTypes: opts.componentTypes
        ? `${opts.componentTypes}`
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean) as MetadataType[]
        : undefined,
      components: opts.components
        ? `${opts.components}`
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean)
        : undefined,
    });
  });

program
  .command("ui")
  .description("Launch local web UI for scoped scanner runs")
  .option("--repo <path>", "Repository root path", process.cwd())
  .option("--package <path>", "Path to package.xml")
  .option("--target-org <alias>", "Salesforce org alias")
  .option("--port <number>", "UI server port", "4173")
  .action((opts) => {
    startUiServer({
      repo: opts.repo,
      packagePath: opts.package,
      targetOrg: opts.targetOrg,
      port: Number(opts.port) || 4173,
    });
  });

program.parseAsync(process.argv);
