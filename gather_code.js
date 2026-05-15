import fs from "fs";
import path from "path";
const OUTPUT_FILE = "project_code_dump.md";
// Target specific frontend source paths based on your project tree
const TARGET_DIRS = [
  "src/frontend/components",
  "src/frontend/hooks",
  "src/frontend/pages",
  "src/frontend/styles",
  "src/frontend/utils",
];
// Configuration files at the root level to review build/layer changes
const ROOT_FILES = ["vite.config.mjs", "package.json"];
// Map extensions to Markdown block highlighting names
const EXTENSION_MAP = {
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".css": "css",
};
function getFilesRecursively(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursively(fullPath));
    } else {
      const ext = path.extname(fullPath);
      if (Object.keys(EXTENSION_MAP).includes(ext)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}
function generateDump() {
  console.log("🚀 Starting project code aggregation...");

  let markdownContent = `# Project Code Dump\n`;
  markdownContent += `Generated on: ${new Date().toISOString()}\n\n`;
  // 1. Scan the focused source directories
  let filesToProcess = [];
  for (const targetDir of TARGET_DIRS) {
    const resolvedPath = path.normalize(targetDir);
    if (fs.existsSync(resolvedPath)) {
      console.log(`Scanning: ${resolvedPath}`);
      filesToProcess = filesToProcess.concat(getFilesRecursively(resolvedPath));
    } else {
      console.log(`⚠️ Directory not found, skipping: ${resolvedPath}`);
    }
  }
  // 2. Scan explicitly targeted root configuration files
  for (const rootFile of ROOT_FILES) {
    const resolvedPath = path.normalize(rootFile);
    if (fs.existsSync(resolvedPath)) {
      filesToProcess.push(resolvedPath);
    }
  }
  // 3. Process and append code chunks cleanly
  for (const filePath of filesToProcess) {
    const ext = path.extname(filePath);
    const lang = EXTENSION_MAP[ext] || "text";

    console.log(`Reading: ${filePath}`);
    try {
      const content = fs.readFileSync(filePath, "utf-8");

      markdownContent += `## File: ${filePath.replace(/\\/g, "/")}\n`;
      markdownContent += `\`\`\`${lang}\n`;
      markdownContent += content;
      markdownContent += `\n\`\`\`\n\n`;
    } catch (err) {
      console.error(`❌ Error reading ${filePath}:`, err.message);
    }
  }
  fs.writeFileSync(OUTPUT_FILE, markdownContent, "utf-8");
  console.log(`\n✅ Core compilation done! File written to: ${OUTPUT_FILE}`);
}
generateDump();
