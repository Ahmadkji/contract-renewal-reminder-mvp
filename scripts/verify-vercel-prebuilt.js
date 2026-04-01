const fs = require("node:fs");
const path = require("node:path");

const rootDir = process.cwd();
const args = new Set(process.argv.slice(2));
const packageJsonPath = path.join(rootDir, "package.json");
const outputDir = path.join(rootDir, ".vercel", "output");
const buildsPath = path.join(outputDir, "builds.json");
const configPath = path.join(outputDir, "config.json");
const functionsDir = path.join(outputDir, "functions");
const staticDir = path.join(outputDir, "static");

function fail(message, details = []) {
  console.error(`[vercel-prebuilt] ${message}`);

  for (const detail of details) {
    console.error(`[vercel-prebuilt] ${detail}`);
  }

  process.exit(1);
}

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) {
    fail(`Missing ${label}: ${path.relative(rootDir, filePath)}`);
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(`Invalid ${label}: ${path.relative(rootDir, filePath)}`, [message]);
  }
}

function directoryHasFiles(directoryPath) {
  return fs.existsSync(directoryPath) && fs.readdirSync(directoryPath).length > 0;
}

function verifyPlatformConstraint() {
  const packageJson = readJson(packageJsonPath, "package.json");
  const hasSharp = Boolean(
    packageJson.dependencies?.sharp ||
      packageJson.optionalDependencies?.sharp ||
      packageJson.devDependencies?.sharp
  );

  if (!hasSharp) {
    return;
  }

  if (process.platform !== "linux" || process.arch !== "x64") {
    fail(
      "Refusing `vercel deploy --prebuilt` outside Linux x64 for this app.",
      [
        "This project depends on `sharp`, which uses native binaries.",
        "Vercel documents that local builds with native dependencies target the builder machine architecture and may not match production.",
        "Use `npm run vercel:deploy:prod` for a remote Vercel build, or run the prebuilt flow from Linux x64 CI.",
      ]
    );
  }
}

function verifyOutput() {
  const builds = readJson(buildsPath, "Vercel build manifest");
  const config = readJson(configPath, "Vercel output config");
  const buildEntries = Array.isArray(builds.builds) ? builds.builds : [];

  if (builds.error) {
    fail("The previous `vercel build` wrote an error into `.vercel/output/builds.json`.", [
      builds.error.message || JSON.stringify(builds.error),
    ]);
  }

  if (buildEntries.length === 0) {
    fail("No build entries were written to `.vercel/output/builds.json`.");
  }

  const failedEntry = buildEntries.find((entry) => entry && entry.error);
  if (failedEntry) {
    fail("The previous `vercel build` contains a failed builder entry.", [
      failedEntry.error.message || JSON.stringify(failedEntry.error),
    ]);
  }

  if (config.version !== 3) {
    fail(`Unexpected Build Output API version: ${String(config.version)}.`);
  }

  const hasRoutes = Array.isArray(config.routes) && config.routes.length > 0;
  const hasFunctions = directoryHasFiles(functionsDir);
  const hasStatic = directoryHasFiles(staticDir);

  if (!hasRoutes && !hasFunctions && !hasStatic) {
    fail("`.vercel/output` does not contain routes, functions, or static files.");
  }

  const summary = [];

  if (hasRoutes) {
    summary.push(`${config.routes.length} routes`);
  }

  if (hasFunctions) {
    summary.push("functions");
  }

  if (hasStatic) {
    summary.push("static assets");
  }

  console.log(`[vercel-prebuilt] Verified .vercel/output: ${summary.join(", ")}.`);
}

if (args.has("--require-linux-x64")) {
  verifyPlatformConstraint();
}

if (!args.has("--skip-output-check")) {
  verifyOutput();
}
