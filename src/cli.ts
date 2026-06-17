#!/usr/bin/env node
import { Command } from "commander";
import { analyzeCommand } from "./commands/analyze.js";
import { OutputFormat, RunMode } from "./types/models.js";

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
    });
  });

program.parseAsync(process.argv);
