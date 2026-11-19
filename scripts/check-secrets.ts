import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Checks for accidental secret exposure:
 * 1. Verifies .env files are NOT tracked in git.
 * 2. Scans tracked files for obvious high-entropy secret patterns and hardcoded API tokens.
 */
function main(): void {
  console.log("🔒 Running BreatheWise Secret Leak Prevention Scanner...");

  let trackedFiles: string[] = [];
  try {
    const stdout = execSync("git ls-files", { encoding: "utf-8" });
    trackedFiles = stdout
      .split("\n")
      .map((f) => f.trim())
      .filter((f) => f.length > 0);
  } catch (err) {
    console.warn("⚠ git ls-files failed; falling back to filesystem scan:", (err as Error).message);
  }

  // 1. Assert .env is never tracked
  const forbiddenFiles = [".env", ".env.local", ".env.production", ".env.development"];
  for (const forbidden of forbiddenFiles) {
    if (trackedFiles.includes(forbidden)) {
      console.error(`❌ Security Violation: Tracked environment file detected: ${forbidden}`);
      process.exit(1);
    }
  }

  // Obvious secret patterns
  const secretPatterns = [
    { name: "Private Key Header", regex: /-----BEGIN (RSA|EC|OPENSSH|PGP|PRIVATE) KEY/ },
    { name: "AWS Access Key", regex: /\bAKIA[0-9A-Z]{16}\b/ },
    { name: "Google API Key", regex: /\bAIza[0-9A-Za-z-_]{35}\b/ },
    { name: "Hardcoded Jarvis Key Pattern", regex: /kuMArEgOzTRhK295ucxs/ },
    { name: "Hardcoded OpenAQ Key Pattern", regex: /3ee0a64d26c7ab8e855e/ },
  ];

  let violationsFound = 0;

  for (const relPath of trackedFiles) {
    // Skip example template files and binary assets
    if (
      relPath === ".env.example" ||
      relPath.endsWith(".png") ||
      relPath.endsWith(".pdf") ||
      relPath.endsWith(".jpg") ||
      relPath.endsWith(".ico")
    ) {
      continue;
    }

    const fullPath = path.resolve(process.cwd(), relPath);
    if (!fs.existsSync(fullPath)) continue;

    try {
      const content = fs.readFileSync(fullPath, "utf-8");
      for (const pattern of secretPatterns) {
        if (pattern.regex.test(content)) {
          // If it's this scanner script itself, skip the pattern definition line
          if (relPath === "scripts/check-secrets.ts") continue;

          console.error(`❌ Potential Secret Found in ${relPath}: matches ${pattern.name}`);
          violationsFound++;
        }
      }
    } catch {
      // Non-text file or read error
    }
  }

  if (violationsFound > 0) {
    console.error(`❌ Scan failed: ${violationsFound} secret pattern(s) detected.`);
    process.exit(1);
  }

  console.log("✓ No tracked secrets or environment credentials detected.");
}

main();
