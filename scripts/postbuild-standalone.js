const fs = require("node:fs");
const path = require("node:path");

const rootDir = process.cwd();
const nextDir = path.join(rootDir, ".next");
const standaloneDir = path.join(nextDir, "standalone");

function copyDirectory(sourcePath, destinationPath, label, required = true) {
  if (!fs.existsSync(sourcePath)) {
    if (required) {
      throw new Error(`Missing ${label} source directory: ${sourcePath}`);
    }
    console.warn(`[postbuild] Skipping ${label}; source not found.`);
    return;
  }

  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.cpSync(sourcePath, destinationPath, { recursive: true, force: true });
  console.log(`[postbuild] Copied ${label} to ${path.relative(rootDir, destinationPath)}`);
}

function run() {
  if (!fs.existsSync(standaloneDir)) {
    throw new Error(
      "Missing .next/standalone output. Ensure Next.js standalone output is enabled via `output: \"standalone\"` in next.config.ts."
    );
  }

  copyDirectory(
    path.join(nextDir, "static"),
    path.join(standaloneDir, ".next", "static"),
    ".next/static"
  );
  copyDirectory(path.join(rootDir, "public"), path.join(standaloneDir, "public"), "public", false);
}

try {
  run();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[postbuild] ${message}`);
  process.exit(1);
}
