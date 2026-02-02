#!/usr/bin/env node
import { execSync } from "child_process";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fs from "fs";
import { watch } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const distFile = path.join(projectRoot, "dist", "index.js");
const srcDir = path.join(projectRoot, "src");

// Load .env
dotenv.config({ path: path.join(projectRoot, ".env") });

const env = {
  CONVEX_DEPLOYMENT_URL: process.env.CONVEX_DEPLOYMENT_URL,
  CONVEX_INTERNAL_AUTH_TOKEN: process.env.CONVEX_INTERNAL_AUTH_TOKEN,
  LOGO_DEV_SECRET_KEY: process.env.LOGO_DEV_SECRET_KEY,
  LOGO_DEV_PUBLISHABLE_KEY: process.env.LOGO_DEV_PUBLISHABLE_KEY,
};

let isBuilding = false;

async function build() {
  if (isBuilding) return;
  isBuilding = true;
  
  console.log("📦 Building indexer...");
  try {
    execSync(`esbuild src/index.ts --bundle --outfile=dist/index.js --platform=node --format=esm --external:node:* "--banner:js=import { createRequire } from 'module'; const require = createRequire(import.meta.url);"`, {
      cwd: projectRoot,
      stdio: "inherit",
    });
    console.log("✅ Build successful at", new Date().toLocaleTimeString());
  } catch (err) {
    console.error("❌ Build failed");
  } finally {
    isBuilding = false;
  }
}

function watchSrcDirectory() {
  console.log("👁️  Watching for changes in src directory...");
  
  const watcher = watch(srcDir, { recursive: true }, (eventType, filename) => {
    if (filename && (filename.endsWith('.ts') || filename.endsWith('.js'))) {
      console.log(`\n📝 Detected change in ${filename}`);
      build();
    }
  });
  
  return watcher;
}

async function loadWorkerModule() {
  try {
    // Import with timestamp to bypass cache
    const module = await import(`file://${distFile}?t=${Date.now()}`);
    return module.default || module;
  } catch (err) {
    console.error("Failed to load worker module:", err);
    return null;
  }
}

async function startServer() {
  console.log("🔥 Starting HTTP server on port 8787...");
  
  const server = createServer(async (req, res) => {
    try {
      const handler = await loadWorkerModule();
      
      if (!handler || typeof handler.fetch !== "function") {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Worker handler not found or invalid" }));
        return;
      }

      const url = `http://localhost:8787${req.url}`;
      const request = new Request(url, {
        method: req.method,
        headers: req.headers,
        body: req.method !== "GET" && req.method !== "HEAD" ? req : null,
        duplex: 'half'
      });

      const response = await handler.fetch(request, env);
      
      const responseHeaders = Object.fromEntries(response.headers);
      res.writeHead(response.status, responseHeaders);
      res.end(await response.text());
    } catch (err) {
      console.error("Request error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  });

  server.listen(8787, () => {
    console.log("✨ Server ready on http://localhost:8787");
  });
}

async function run() {
  await build();
  watchSrcDirectory();
  await startServer();
}

run();