import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCollectorManager, sanitizeError } from "./probes.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIST_DIR = path.resolve(__dirname, "../dist");

const API_SECURITY_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

const SPA_CSP_HEADER =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none';";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const MAX_URL_LENGTH = 256;

/**
 * Creates the Nidavellir Collector + Static SPA HTTP server.
 */
export function createCollectorServer(
  manager = createCollectorManager(),
  { distDir = DEFAULT_DIST_DIR } = {},
) {
  const server = http.createServer(async (req, res) => {
    const method = req.method || "GET";
    if (method !== "GET" && method !== "HEAD") {
      res.writeHead(405, {
        ...API_SECURITY_HEADERS,
        Allow: "GET, HEAD",
      });
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    const rawUrl = req.url || "/";
    if (rawUrl.length > MAX_URL_LENGTH) {
      res.writeHead(414, API_SECURITY_HEADERS);
      res.end(
        method === "HEAD"
          ? undefined
          : JSON.stringify({ error: "URI Too Long" }),
      );
      return;
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(rawUrl, "http://127.0.0.1");
    } catch {
      res.writeHead(400, API_SECURITY_HEADERS);
      res.end(
        method === "HEAD"
          ? undefined
          : JSON.stringify({ error: "Invalid request URL" }),
      );
      return;
    }

    const pathname =
      parsedUrl.pathname.replace(/\/+/g, "/").replace(/\/$/, "") || "/";

    if (pathname === "/api/health" || pathname === "/health") {
      const body = JSON.stringify({
        ok: true,
        service: "nidavellir-collector",
        timestamp: new Date().toISOString(),
      });
      res.writeHead(200, API_SECURITY_HEADERS);
      res.end(method === "HEAD" ? undefined : body);
      return;
    }

    if (pathname === "/api/dashboard") {
      const forceRefresh =
        parsedUrl.searchParams.get("refresh") === "1" ||
        parsedUrl.searchParams.get("refresh") === "true";

      try {
        const data = await manager.getDashboardData({ forceRefresh });
        const body = JSON.stringify(data);
        res.writeHead(200, API_SECURITY_HEADERS);
        res.end(method === "HEAD" ? undefined : body);
      } catch (err) {
        res.writeHead(503, API_SECURITY_HEADERS);
        res.end(
          method === "HEAD"
            ? undefined
            : JSON.stringify({
                error: "Telemetry collection unavailable",
                detail: sanitizeError(err),
              }),
        );
      }
      return;
    }

    if (pathname === "/api" || pathname.startsWith("/api/")) {
      res.writeHead(404, API_SECURITY_HEADERS);
      res.end(
        method === "HEAD" ? undefined : JSON.stringify({ error: "Not Found" }),
      );
      return;
    }

    // Serve compiled SPA static files from distDir with strict path-traversal guard
    try {
      const safeRelPath =
        pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
      const resolvedPath = path.resolve(distDir, safeRelPath);
      const distRootWithSep = distDir.endsWith(path.sep)
        ? distDir
        : `${distDir}${path.sep}`;

      if (
        resolvedPath !== path.join(distDir, "index.html") &&
        !resolvedPath.startsWith(distRootWithSep)
      ) {
        res.writeHead(403, API_SECURITY_HEADERS);
        res.end(method === "HEAD" ? undefined : "Forbidden");
        return;
      }

      let targetFile = resolvedPath;
      let isAsset = pathname.startsWith("/assets/");
      try {
        const st = await fs.stat(targetFile);
        if (!st.isFile()) {
          targetFile = path.join(distDir, "index.html");
          isAsset = false;
        }
      } catch {
        if (isAsset) {
          res.writeHead(404, API_SECURITY_HEADERS);
          res.end(
            method === "HEAD"
              ? undefined
              : JSON.stringify({ error: "Asset Not Found" }),
          );
          return;
        }
        targetFile = path.join(distDir, "index.html");
      }

      const ext = path.extname(targetFile).toLowerCase();
      const contentType = MIME_TYPES[ext] || "application/octet-stream";
      const content = await fs.readFile(targetFile);

      res.writeHead(200, {
        "Content-Type": contentType,
        "Cache-Control": isAsset
          ? "public, max-age=31536000, no-transform, immutable"
          : "no-cache, no-store, must-revalidate",
        "Content-Security-Policy": SPA_CSP_HEADER,
        "X-Frame-Options": "DENY",
        "X-Content-Type-Options": "nosniff",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "no-referrer",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      });
      res.end(method === "HEAD" ? undefined : content);
    } catch {
      res.writeHead(404, API_SECURITY_HEADERS);
      res.end(
        method === "HEAD" ? undefined : JSON.stringify({ error: "Not Found" }),
      );
    }
  });

  server.headersTimeout = 5_000;
  server.requestTimeout = 5_000;
  server.keepAliveTimeout = 5_000;
  server.maxHeadersCount = 32;

  return server;
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const host = process.env.COLLECTOR_BIND_HOST || "127.0.0.1";
  const port = Number(process.env.COLLECTOR_PORT || 3001);
  const server = createCollectorServer();

  server.listen(port, host, () => {
    console.log(
      `[nidavellir-collector] listening on http://${host}:${port} (PID ${process.pid})`,
    );
  });

  const shutdown = (signal) => {
    console.log(`[nidavellir-collector] received ${signal}, shutting down...`);
    server.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 3000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
