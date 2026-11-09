import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

// Share the repo-root .env with the backend. Next has already loaded frontend/.env*
// by now (and caches loadEnvConfig), so read the root file directly; values that are
// already set, from the shell or frontend/.env.local, take precedence.
const rootEnv = path.resolve(process.cwd(), "..", ".env");
if (fs.existsSync(rootEnv)) {
  for (const line of fs.readFileSync(rootEnv, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
  }
}

const nextConfig: NextConfig = {};

export default nextConfig;
