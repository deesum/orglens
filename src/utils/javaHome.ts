import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let cached: string | null | undefined;

function isWorkingJava(home: string): boolean {
  try {
    const bin = path.join(
      home,
      "bin",
      process.platform === "win32" ? "java.exe" : "java",
    );
    if (!fs.existsSync(bin)) return false;
    const result = spawnSync(bin, ["-version"], { encoding: "utf8" });
    return result.status === 0;
  } catch {
    return false;
  }
}

function listSubdirs(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() || e.isSymbolicLink())
      .map((e) => path.join(dir, e.name));
  } catch {
    return [];
  }
}

/** Ranks JDK candidates so newer LTS versions win (17 > 21 > 11 > others). */
function preferenceScore(p: string): number {
  const lower = p.toLowerCase();
  if (lower.includes("17")) return 4;
  if (lower.includes("21")) return 3;
  if (lower.includes("11")) return 2;
  return 1;
}

function candidateHomes(): string[] {
  const homes: string[] = [];

  // Homebrew (Apple Silicon + Intel)
  for (const base of ["/opt/homebrew/opt", "/usr/local/opt"]) {
    for (const dir of listSubdirs(base)) {
      if (path.basename(dir).startsWith("openjdk")) {
        // brew keg may expose libexec/openjdk.jdk/Contents/Home
        const macHome = path.join(
          dir,
          "libexec",
          "openjdk.jdk",
          "Contents",
          "Home",
        );
        homes.push(fs.existsSync(macHome) ? macHome : dir);
      }
    }
  }

  // macOS system JVMs
  for (const jvm of listSubdirs("/Library/Java/JavaVirtualMachines")) {
    homes.push(path.join(jvm, "Contents", "Home"));
  }

  // Linux distributions
  for (const jvm of listSubdirs("/usr/lib/jvm")) {
    homes.push(jvm);
  }

  // SDKMAN
  homes.push(
    path.join(os.homedir(), ".sdkman", "candidates", "java", "current"),
  );

  return homes.sort((a, b) => preferenceScore(b) - preferenceScore(a));
}

/**
 * Resolves a usable JAVA_HOME so the Salesforce Code Analyzer (PMD/SFGE) can run
 * even when the macOS `/usr/bin/java` stub shadows a real JDK. The result is
 * cached for the process lifetime.
 */
export function resolveJavaHome(): string | undefined {
  if (cached !== undefined) return cached ?? undefined;

  // 1. Respect an explicitly-set, working JAVA_HOME.
  if (process.env.JAVA_HOME && isWorkingJava(process.env.JAVA_HOME)) {
    cached = process.env.JAVA_HOME;
    return cached;
  }

  // 2. macOS java_home helper (skips the non-functional /usr/bin/java stub).
  try {
    const r = spawnSync("/usr/libexec/java_home", [], { encoding: "utf8" });
    const home = r.stdout?.trim();
    if (r.status === 0 && home && isWorkingJava(home)) {
      cached = home;
      return cached;
    }
  } catch {
    // ignore
  }

  // 3. Probe well-known install locations.
  for (const home of candidateHomes()) {
    if (isWorkingJava(home)) {
      cached = home;
      return cached;
    }
  }

  cached = null;
  return undefined;
}

/** Returns a process env with JAVA_HOME/PATH set when a JDK was found. */
export function javaAwareEnv(): NodeJS.ProcessEnv {
  const home = resolveJavaHome();
  if (!home) return process.env;
  const sep = process.platform === "win32" ? ";" : ":";
  return {
    ...process.env,
    JAVA_HOME: home,
    PATH: `${path.join(home, "bin")}${sep}${process.env.PATH ?? ""}`,
  };
}
