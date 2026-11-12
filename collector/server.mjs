import http from "node:http";
import { fileURLToPath } from "node:url";
import { createCollectorManager, sanitizeError } from "./probes.mjs";

const SECURITY_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
};

const MAX_URL_LENGTH = 256;

/**
 * Creates the Nidavellir Collector HTTP server.
 */
export function createCollectorServer(manager = createCollectorManager()) {
  const server = http.createServer(async (req, res) => {
    const method = req.method || "GET";
    if (method !== "GET" && method !== "HEAD") {
      res.writeHead(405, {
        ...SECURITY_HEADERS,
        Allow: "GET, HEAD",
      });
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    const rawUrl = req.url || "/";
    if (rawUrl.length > MAX_URL_LENGTH) {
      res.writeHead(414, SECURITY_HEADERS);
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
      res.writeHead(400, SECURITY_HEADERS);
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
      res.writeHead(200, SECURITY_HEADERS);
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
        res.writeHead(200, SECURITY_HEADERS);
        res.end(method === "HEAD" ? undefined : body);
      } catch (err) {
        res.writeHead(503, SECURITY_HEADERS);
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

    res.writeHead(404, SECURITY_HEADERS);
    res.end(
      method === "HEAD" ? undefined : JSON.stringify({ error: "Not Found" }),
    );
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
