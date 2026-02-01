#!/usr/bin/env node
import { spawn } from "child_process";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const srcDir = path.join(projectRoot, "src");
const distFile = path.join(projectRoot, "dist", "index.js");

let buildProcess = null;
let httpServer = null;

function buildAndWatch() {
  console.log("📦 Building with esbuild...");
  
  buildProcess = spawn("npx", ["esbuild", "src/index.ts", "--bundle", "--outfile=dist/index.js", "--platform=neutral", "--format=esm", "--watch"], {
    cwd: projectRoot,
    stdio: "inherit",
  });

  buildProcess.on("error", (err) => {
    console.error("Build process error:", err);
  });

  buildProcess.on("close", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`Build process exited with code ${code}`);
    }
  });
}

async function loadWorkerModule() {
  try {
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
      });

      const response = await handler.fetch(request);
      
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(await response.text());
    } catch (err) {
      console.error("Request error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  });

  httpServer = server;
  server.listen(8787, () => {
    console.log("✨ Server ready on http://localhost:8787");
  });

  return server;
}

async function startDev() {
  console.log("🚀 Starting SponsorSpy Indexer dev server...");
  console.log("📁 Watching for changes in:", srcDir);
  
  buildAndWatch();
  
  // Wait for initial build to complete
  setTimeout(async () => {
    await startServer();
  }, 3000);
}

function shutdown() {
  console.log("\n📛 Shutting down...");
  
  // Close HTTP server
  if (httpServer) {
    httpServer.close(() => {
      console.log("✓ HTTP server closed");
    });
  }
  
  // Kill build process and its children
  if (buildProcess) {
    try {
      process.kill(-buildProcess.pid); // Kill process group
    } catch {
      buildProcess.kill(); // Fallback
    }
    console.log("✓ Build process killed");
  }
  
  setTimeout(() => {
    process.exit(0);
  }, 500);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

startDev();
