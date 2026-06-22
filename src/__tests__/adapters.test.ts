import { describe, expect, it } from "vitest";
import {
  ADAPTERS,
  adapterEngineInfos,
  adapterRules,
  getAdapter,
} from "../scanner/adapters/registry.js";
import { isSfEngine, SF_ENGINE_IDS } from "../scanner/engines.js";
import {
  inferComponentName,
  inferMetadataType,
} from "../scanner/inferMetadata.js";

describe("scanner engines", () => {
  it("classifies Salesforce engine ids", () => {
    for (const id of SF_ENGINE_IDS) expect(isSfEngine(id)).toBe(true);
    expect(isSfEngine("semgrep")).toBe(false);
    expect(isSfEngine("orglens-lite")).toBe(false);
  });
});

describe("metadata inference", () => {
  it("infers Apex classes", () => {
    const p = "force-app/main/default/classes/Foo.cls";
    expect(inferMetadataType(p)).toBe("ApexClass");
    expect(inferComponentName(p, "ApexClass")).toBe("Foo");
  });

  it("infers LWC bundles from any path separator", () => {
    const p = "src\\lwc\\myCmp\\myCmp.js";
    expect(inferMetadataType(p)).toBe("LightningComponentBundle");
    expect(inferComponentName(p, "LightningComponentBundle")).toBe("myCmp");
  });
});

describe("adapter registry", () => {
  it("registers Semgrep, Gitleaks, and npm audit", () => {
    const ids = ADAPTERS.map((a) => a.id);
    expect(ids).toEqual(
      expect.arrayContaining(["semgrep", "gitleaks", "npm-audit"]),
    );
    expect(getAdapter("semgrep")?.name).toBe("Semgrep");
    expect(getAdapter("missing")).toBeUndefined();
  });

  it("exposes engine info with status and rule counts", () => {
    const engines = adapterEngineInfos();
    expect(engines.length).toBe(ADAPTERS.length);
    for (const e of engines) {
      expect(typeof e.id).toBe("string");
      expect(["available", "not_installed"]).toContain(e.status);
      expect(e.ruleCount).toBeGreaterThan(0);
      if (!e.available) expect(e.installHint).toBeTruthy();
    }
  });

  it("contributes catalog rules tagged with their engine", () => {
    const rules = adapterRules();
    expect(rules.length).toBeGreaterThan(0);
    const engines = new Set(rules.map((r) => r.engine));
    expect(engines.has("semgrep")).toBe(true);
    expect(engines.has("gitleaks")).toBe(true);
    expect(rules.every((r) => Boolean(r.defaultSeverity))).toBe(true);
  });

  it("npm audit only applies when a package.json exists", () => {
    const npm = getAdapter("npm-audit")!;
    expect(npm.isApplicable({ repoPath: process.cwd() })).toBe(true);
    expect(npm.isApplicable({ repoPath: "/" })).toBe(false);
  });
});
