import fs from "node:fs";
import path from "node:path";

const MAX_LINES_CEILING = 250;

function getAllSourceFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllSourceFiles(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
      files.push(fullPath);
    }
  }

  return files;
}

function checkFileLengths(): void {
  console.log(`📏 Checking file length constraints under src/ (< ${MAX_LINES_CEILING} lines)...`);

  const srcDir = path.resolve(process.cwd(), "src");
  if (!fs.existsSync(srcDir)) {
    console.error("❌ Error: src directory not found");
    process.exit(1);
  }

  const files = getAllSourceFiles(srcDir);
  const violations: { file: string; lineCount: number }[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    const lines = content.split("\n").length;
    if (lines >= MAX_LINES_CEILING) {
      violations.push({
        file: path.relative(process.cwd(), file),
        lineCount: lines,
      });
    }
  }

  if (violations.length > 0) {
    console.error(
      `❌ File length check failed: ${violations.length} file(s) exceed ${MAX_LINES_CEILING} lines:`,
    );
    for (const v of violations) {
      console.error(`   - ${v.file}: ${v.lineCount} lines (limit: < ${MAX_LINES_CEILING})`);
    }
    process.exit(1);
  }

  console.log(
    `✓ All ${files.length} source files under src/ strictly satisfy the < ${MAX_LINES_CEILING} lines invariant.`,
  );
}

checkFileLengths();
