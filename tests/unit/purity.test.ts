import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Core Domain Architectural Purity", () => {
  const coreDir = path.resolve(__dirname, "../../src/core");
  const coreFiles = fs
    .readdirSync(coreDir)
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".d.ts"));

  it("finds core TypeScript modules", () => {
    expect(coreFiles.length).toBeGreaterThan(5);
  });

  for (const file of coreFiles) {
    describe(`Purity inspection: src/core/${file}`, () => {
      const filePath = path.join(coreDir, file);
      const content = fs.readFileSync(filePath, "utf-8");

      it("never imports from adapters/", () => {
        expect(content).not.toMatch(/from\s+['"].*adapters.*['"]/);
      });

      it("never imports from server/", () => {
        expect(content).not.toMatch(/from\s+['"].*server.*['"]/);
      });

      it("never imports from lib/env", () => {
        expect(content).not.toMatch(/from\s+['"].*lib\/env.*['"]/);
      });

      it("never imports from Next.js packages", () => {
        expect(content).not.toMatch(/from\s+['"]next(\/.*)?['"]/);
      });

      it("never makes network fetch calls", () => {
        expect(content).not.toMatch(/\bfetch\s*\(/);
      });

      it("never accesses process.env", () => {
        expect(content).not.toMatch(/\bprocess\.env\b/);
      });

      it("never calls un-injected non-deterministic functions (Date.now, Math.random)", () => {
        expect(content).not.toMatch(/\bDate\.now\s*\(/);
        expect(content).not.toMatch(/\bMath\.random\s*\(/);
      });
    });
  }
});
