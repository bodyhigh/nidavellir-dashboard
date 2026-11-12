import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SNAPSHOT_PATH = path.resolve(
  __dirname,
  "../src/data/dashboard-snapshot.json",
);

/**
 * Redacts any token-like strings or sensitive patterns from error messages.
 * @param {unknown} err
 * @returns {string}
 */
export function sanitizeError(err) {
  let raw = err instanceof Error ? err.message : String(err ?? "Unknown error");
  const envToken = process.env.GITHUB_TOKEN?.trim();
  if (envToken && envToken.length >= 4) {
    raw = raw.split(envToken).join("[REDACTED]");
  }
  return raw
    .replace(
      /\b(gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+)\b/g,
      "[REDACTED]",
    )
    .replace(/(Bearer|token)\s+[^\s"']+/gi, "$1 [REDACTED]")
    .slice(0, 240);
}

/**
 * Formats a Date into PST/PDT readable string ("YYYY-MM-DD HH:mm PST").
 * @param {Date} date
 * @returns {string}
 */
export function formatTimestampPST(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZoneName: "short",
    }).formatToParts(date);
    const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")} ${get("timeZoneName") || "PT"}`;
  } catch {
    return date.toISOString();
  }
}

/**
 * Fast non-throwing TCP port probe.
 * @param {string} host
 * @param {number} port
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
export function probeTcpPort(host, port, timeoutMs = 600) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}

/**
 * Reads latest commit SHA and subject from a local git repository using execFile (no shell).
 * Strips sensitive env vars and uses --no-optional-locks for read-only safety.
 * @param {string} repoDir
 * @param {number} timeoutMs
 * @returns {Promise<{ sha: string, message: string } | null>}
 */
export async function probeLocalGitHead(repoDir, timeoutMs = 1500) {
  if (!repoDir) return null;
  try {
    const stat = await fs.stat(repoDir);
    if (!stat.isDirectory()) return null;
    const { stdout } = await execFileAsync(
      "git",
      ["--no-optional-locks", "-C", repoDir, "log", "-1", "--format=%h%x09%s"],
      {
        timeout: timeoutMs,
        maxBuffer: 64 * 1024,
        env: {
          PATH: process.env.PATH || "/usr/bin:/bin",
          HOME: "/tmp",
          GIT_CONFIG_NOSYSTEM: "1",
          GIT_TERMINAL_PROMPT: "0",
        },
      },
    );
    const line = stdout.trim();
    const tabIdx = line.indexOf("\t");
    if (tabIdx <= 0) return null;
    return {
      sha: line.slice(0, tabIdx).trim(),
      message: line.slice(tabIdx + 1).trim(),
    };
  } catch {
    return null;
  }
}

/**
 * Queries GitHub REST API for latest branch commit and open/closed issues.
 * Never exposes tokens; only sends Authorization header to api.github.com.
 */
export async function probeGitHubUpstream({
  uiRepo = "bodyhigh/manifesting-ui",
  apiRepo = "bodyhigh/manifesting-api",
  dashboardRepo = "bodyhigh/nidavellir-dashboard",
  githubToken = process.env.GITHUB_TOKEN || "",
  fetchImpl = globalThis.fetch,
  timeoutMs = 3500,
} = {}) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "nidavellir-dashboard-collector/1.1",
  };
  if (githubToken && typeof githubToken === "string" && githubToken.trim()) {
    headers.Authorization = `Bearer ${githubToken.trim()}`;
  }

  const fetchJson = async (url) => {
    const res = await fetchImpl(url, {
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      throw new Error(`GitHub HTTP ${res.status} for ${new URL(url).pathname}`);
    }
    return res.json();
  };

  const results = await Promise.allSettled([
    fetchJson(`https://api.github.com/repos/${uiRepo}/commits/main`),
    fetchJson(`https://api.github.com/repos/${apiRepo}/commits/main`),
    fetchJson(
      `https://api.github.com/repos/${dashboardRepo}/issues?state=all&per_page=30`,
    ),
  ]);

  const uiCommit =
    results[0].status === "fulfilled" && results[0].value?.sha
      ? {
          sha: String(results[0].value.sha).slice(0, 7),
          message:
            String(results[0].value.commit?.message ?? "").split("\n")[0] ?? "",
        }
      : null;

  const apiCommit =
    results[1].status === "fulfilled" && results[1].value?.sha
      ? {
          sha: String(results[1].value.sha).slice(0, 7),
          message:
            String(results[1].value.commit?.message ?? "").split("\n")[0] ?? "",
        }
      : null;

  const rawIssues =
    results[2].status === "fulfilled" && Array.isArray(results[2].value)
      ? results[2].value
      : null;

  const errors = results
    .filter((r) => r.status === "rejected")
    .map((r) => sanitizeError(r.reason));

  const allSucceeded =
    errors.length === 0 &&
    Boolean(uiCommit && apiCommit && Array.isArray(rawIssues));

  return {
    reachable: allSucceeded,
    partial: Boolean(uiCommit || apiCommit || rawIssues),
    uiCommit,
    apiCommit,
    rawIssues,
    error: errors.length > 0 ? errors[0] : null,
  };
}

/**
 * Converts GitHub issue objects into StoryItem records, falling back to baseline stories.
 */
export function mapGitHubIssuesToStories(rawIssues, fallbackStories = []) {
  if (!Array.isArray(rawIssues) || rawIssues.length === 0) {
    return fallbackStories;
  }

  const fallbackByKey = new Map((fallbackStories || []).map((s) => [s.key, s]));
  const mapped = [];

  for (const item of rawIssues) {
    if (item.pull_request) continue;
    const titleStr = String(item.title ?? "").slice(0, 200);
    const match = titleStr.match(/^(INFRA-\d+):\s*(.+)$/i);
    const key = match ? match[1].toUpperCase() : `ISSUE-${item.number}`;
    const cleanTitle = match ? match[2].trim() : titleStr;
    const body = String(item.body ?? "").slice(0, 2000);

    const existing = fallbackByKey.get(key);
    let priority = existing?.priority ?? "P2";
    const prioMatch = body.match(/Priority:\s*(P[0-3])/i);
    if (prioMatch) {
      priority = prioMatch[1].toUpperCase();
    }

    let status = existing?.status ?? "backlog";
    if (item.state === "closed") {
      status = "complete";
    } else if (key === "INFRA-001") {
      status = "held";
    } else if (
      !existing &&
      [
        "INFRA-004",
        "INFRA-005",
        "INFRA-007",
        "INFRA-008",
        "INFRA-009",
        "INFRA-010",
        "INFRA-011",
      ].includes(key)
    ) {
      status = "active";
    }

    const fallbackSummary = existing?.summary ?? cleanTitle;
    mapped.push({
      key,
      title: cleanTitle,
      priority,
      status,
      summary: fallbackSummary,
      issueNumber: item.number,
    });
  }

  mapped.sort((a, b) =>
    a.key.localeCompare(b.key, undefined, { numeric: true }),
  );
  return mapped.length > 0 ? mapped : fallbackStories;
}

/**
 * Probes Nidavellir agent sockets, bridge configs, and Hermes ports.
 */
export async function probeNidavellirAgents(
  baselineAgents,
  {
    nidavellirRoot = process.env.NIDAVELLIR_ROOT ||
      "/home/moreno/.gemini/antigravity/scratch/nidavellir",
    zeroCoolDir = process.env.ZERO_COOL_DIR || "/srv/data/volumes/zero-cool",
    codexSocketsDir = process.env.CODEX_SOCKETS_DIR || "/tmp/codex-app-tools",
    hermesHost = process.env.HERMES_HOST || "127.0.0.1",
    hermesPort = Number(process.env.HERMES_PORT || 9119),
    tcpProbeImpl = probeTcpPort,
  } = {},
) {
  const nowPST = formatTimestampPST(new Date());
  let probesSucceeded = 0;

  // 1. Check Antigravity workspace
  let agActive = false;
  try {
    const stat = await fs.stat(nidavellirRoot);
    agActive = stat.isDirectory();
    if (agActive) probesSucceeded++;
  } catch {
    agActive = false;
  }

  // 2. Check Hermes TCP port + Zero Cool / Cereal Killer state
  const hermesListening = await tcpProbeImpl(hermesHost, hermesPort, 500);
  let zcGatewayOk = false;
  let zcCheckpoint = nowPST;
  try {
    const gwPath = path.join(zeroCoolDir, "gateway_state.json");
    const gwStat = await fs.stat(gwPath);
    zcGatewayOk = gwStat.isFile();
    zcCheckpoint = formatTimestampPST(gwStat.mtime);
    probesSucceeded++;
  } catch {
    zcGatewayOk = false;
  }

  let ckConfigOk = false;
  try {
    const ckPath = path.join(
      zeroCoolDir,
      "profiles/cereal_killer/runtime/codex-bridge/host-config.json",
    );
    const ckStat = await fs.stat(ckPath);
    ckConfigOk = ckStat.isFile();
    probesSucceeded++;
  } catch {
    ckConfigOk = false;
  }

  // 3. Check Codex Desktop sockets in /tmp/codex-app-tools (capped at 64 entries)
  let codexSocketCount = 0;
  let codexLatestMtime = null;
  try {
    const entries = await fs.readdir(codexSocketsDir);
    const socks = entries.filter((e) => e.endsWith(".sock")).slice(0, 64);
    if (socks.length > 0) {
      const stats = await Promise.all(
        socks.map((s) =>
          fs.stat(path.join(codexSocketsDir, s)).catch(() => null),
        ),
      );
      const validStats = stats.filter(
        (st) => st && (st.isSocket() || st.isFile()),
      );
      codexSocketCount = validStats.length;
      if (codexSocketCount > 0) {
        probesSucceeded++;
        for (const st of validStats) {
          if (!codexLatestMtime || st.mtime > codexLatestMtime) {
            codexLatestMtime = st.mtime;
          }
        }
      }
    }
  } catch {
    codexSocketCount = 0;
  }

  const agents = (baselineAgents || []).map((agent) => {
    if (agent.id === "antigravity") {
      return {
        ...agent,
        status: agActive ? "active" : agent.status,
        lastCheckpoint: nowPST,
        currentFocus: agActive
          ? "Live Telemetry Collector & Multi-Agent Adversarial Review"
          : agent.currentFocus,
      };
    }
    if (agent.id === "cereal-killer") {
      const isOnline = hermesListening || ckConfigOk;
      return {
        ...agent,
        status: isOnline ? "active" : "standby",
        lastCheckpoint: isOnline ? zcCheckpoint : agent.lastCheckpoint,
        currentFocus: isOnline
          ? `Hermes Profile Ready (${hermesListening ? "127.0.0.1:9119 UP" : "Bridge Configured"})`
          : agent.currentFocus,
      };
    }
    if (agent.id === "zero-cool") {
      const isOnline = hermesListening || zcGatewayOk;
      return {
        ...agent,
        status: isOnline ? "active" : "standby",
        lastCheckpoint: zcGatewayOk ? zcCheckpoint : agent.lastCheckpoint,
        currentFocus: isOnline
          ? `Gateway Telemetry Active (${zcGatewayOk ? "gateway_state verified" : "Hermes UP"})`
          : agent.currentFocus,
      };
    }
    if (agent.id === "codex") {
      const hasSocks = codexSocketCount > 0;
      return {
        ...agent,
        status: hasSocks ? "idle" : "standby",
        lastCheckpoint: codexLatestMtime
          ? formatTimestampPST(codexLatestMtime)
          : agent.lastCheckpoint,
        currentFocus: hasSocks
          ? `App-Tools IPC Ready (${codexSocketCount} active socket${codexSocketCount === 1 ? "" : "s"})`
          : agent.currentFocus,
      };
    }
    return agent;
  });

  return {
    agents,
    hostProbesActive: probesSucceeded > 0,
  };
}

/**
 * Probes live host OS, memory, Node runtime, and filesystem metrics.
 */
export async function probeHostInfrastructure(
  baselineInfra,
  { githubReachable = false, mode = "live", cacheAgeSeconds = 0 } = {},
) {
  const load1m = os.loadavg()[0]?.toFixed(2) ?? "0.00";
  const uptimeHours = (os.uptime() / 3600).toFixed(1);
  const totalMemGb = (os.totalmem() / 1024 ** 3).toFixed(1);
  const freeMemGb = (os.freemem() / 1024 ** 3).toFixed(1);
  const rssMb = (process.memoryUsage().rss / 1024 ** 2).toFixed(1);

  let diskValue = "NVMe Primary Mount";
  let diskDetail = "tmpfs mounts for /tmp, /var/run, /var/cache/nginx";
  let diskStatus = "healthy";
  try {
    if (typeof fs.statfs === "function") {
      const st = await fs.statfs("/");
      const totalBytes = Number(st.blocks) * Number(st.bsize);
      const freeBytes = Number(st.bavail) * Number(st.bsize);
      if (totalBytes > 0) {
        const freeGib = (freeBytes / 1024 ** 3).toFixed(1);
        const totalGib = (totalBytes / 1024 ** 3).toFixed(1);
        const freePct = ((freeBytes / totalBytes) * 100).toFixed(1);
        diskValue = `${freeGib} GiB free / ${totalGib} GiB (${freePct}%)`;
        diskDetail = `Live statfs(/) probe · tmpfs ephemeral mounts active`;
        diskStatus = Number(freePct) < 10 ? "warning" : "optimal";
      }
    }
  } catch {
    // Keep baseline fallback if statfs fails
  }

  return (baselineInfra || []).map((metric) => {
    if (metric.category === "Host Machine") {
      return {
        ...metric,
        value: `${os.type()} ${os.release()} (${os.arch()})`,
        status: Number(load1m) > os.cpus().length * 2 ? "warning" : "optimal",
        detail: `Load 1m: ${load1m} · RAM: ${freeMemGb}/${totalMemGb} GiB free · Uptime: ${uptimeHours}h`,
      };
    }
    if (metric.category === "Runtime Toolchain") {
      return {
        ...metric,
        value: `Node ${process.version} (Collector Live)`,
        status: "optimal",
        detail: `Collector PID ${process.pid} · RSS ${rssMb} MiB · Zero client secrets`,
      };
    }
    if (metric.category === "Storage Engine") {
      return {
        ...metric,
        value: diskValue,
        status: diskStatus,
        detail: diskDetail,
      };
    }
    if (metric.category === "Demo Resilience") {
      return {
        ...metric,
        value: githubReachable
          ? "Live Upstream + Cache Ready"
          : mode === "cached"
            ? `Cached Mode (${cacheAgeSeconds}s old)`
            : "Offline Snapshot Ready",
        status: githubReachable ? "optimal" : "healthy",
        detail: githubReachable
          ? "Live GitHub + host probes active; atomic cache persisted"
          : "Serving last-known-good telemetry without network interruption",
      };
    }
    return metric;
  });
}

function updateDemoResilienceAge(
  infrastructure,
  githubReachable,
  mode,
  ageSec,
) {
  if (!Array.isArray(infrastructure)) return infrastructure;
  return infrastructure.map((metric) => {
    if (metric.category !== "Demo Resilience") return metric;
    return {
      ...metric,
      value: githubReachable
        ? "Live Upstream + Cache Ready"
        : mode === "cached"
          ? `Cached Mode (${ageSec}s old)`
          : "Offline Snapshot Ready",
    };
  });
}

/**
 * Creates a stateful collector with TTL caching, single-flight deduplication,
 * and atomic disk persistence.
 */
export function createCollectorManager({
  snapshotPath = DEFAULT_SNAPSHOT_PATH,
  cacheFilePath = process.env.COLLECTOR_CACHE_FILE ||
    "/tmp/nidavellir-dashboard-cache.json",
  ttlMs = Number(process.env.COLLECTOR_TTL_MS || 30_000),
  minRefreshCooldownMs = Number(
    process.env.COLLECTOR_REFRESH_COOLDOWN_MS || 5_000,
  ),
  uiRepoDir = process.env.MANIFESTING_UI_REPO_PATH ||
    "/home/moreno/.gemini/antigravity/scratch/manifesting-art/manifesting-ui",
  apiRepoDir = process.env.MANIFESTING_API_REPO_PATH ||
    "/home/moreno/.gemini/antigravity/scratch/manifesting-art/manifesting-api",
  probeGitHubImpl = probeGitHubUpstream,
  probeGitImpl = probeLocalGitHead,
  probeAgentsImpl = probeNidavellirAgents,
  probeInfraImpl = probeHostInfrastructure,
} = {}) {
  let memoryCache = null;
  let lastCollectedAtMs = 0;
  let inflightPromise = null;

  async function loadBaselineSnapshot() {
    const raw = await fs.readFile(snapshotPath, "utf8");
    return JSON.parse(raw);
  }

  async function readDiskCache() {
    try {
      const raw = await fs.readFile(cacheFilePath, "utf8");
      const parsed = JSON.parse(raw);
      if (
        !parsed ||
        typeof parsed !== "object" ||
        typeof parsed.releaseBaseline !== "object" ||
        parsed.releaseBaseline === null ||
        typeof parsed.snapshotMeta !== "object" ||
        parsed.snapshotMeta === null
      ) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  async function writeDiskCacheAtomically(payload) {
    const tmpPath = `${cacheFilePath}.${process.pid}.${Date.now()}.tmp`;
    try {
      await fs.writeFile(tmpPath, JSON.stringify(payload, null, 2), {
        encoding: "utf8",
        mode: 0o600,
      });
      await fs.rename(tmpPath, cacheFilePath);
    } catch {
      await fs.unlink(tmpPath).catch(() => {});
    }
  }

  async function collectFresh() {
    const baseline = await loadBaselineSnapshot();
    const diskCache = await readDiskCache();
    const priorCache = memoryCache || diskCache || baseline;
    const now = new Date();
    const nowMs = now.getTime();

    const [ghResult, localUiGit, localApiGit, agentProbeResult] =
      await Promise.all([
        probeGitHubImpl().catch((err) => ({
          reachable: false,
          partial: false,
          uiCommit: null,
          apiCommit: null,
          rawIssues: null,
          error: sanitizeError(err),
        })),
        probeGitImpl(uiRepoDir),
        probeGitImpl(apiRepoDir),
        probeAgentsImpl(baseline.agents),
      ]);

    const uiCommit = ghResult.uiCommit || localUiGit;
    const apiCommit = ghResult.apiCommit || localApiGit;

    // Mode is "live" strictly when upstream GitHub is reachable without error
    const mode = ghResult.reachable ? "live" : "cached";

    const priorCapturedAt =
      priorCache.snapshotMeta?.capturedAt || baseline.snapshotMeta.capturedAt;
    const priorCapturedPST =
      priorCache.snapshotMeta?.capturedTimestampPST ||
      baseline.snapshotMeta.capturedTimestampPST;

    const capturedAt = ghResult.reachable ? now.toISOString() : priorCapturedAt;
    const capturedTimestampPST = ghResult.reachable
      ? formatTimestampPST(now)
      : priorCapturedPST;

    const parsedCaptureMs = Date.parse(capturedAt);
    const cacheAgeSeconds = ghResult.reachable
      ? 0
      : Number.isFinite(parsedCaptureMs)
        ? Math.max(0, Math.floor((nowMs - parsedCaptureMs) / 1000))
        : 0;

    const releaseBaseline = {
      ...priorCache.releaseBaseline,
      latestCommitSha:
        uiCommit?.sha || priorCache.releaseBaseline.latestCommitSha,
      latestCommitMessage:
        uiCommit?.message || priorCache.releaseBaseline.latestCommitMessage,
      apiCommitSha: apiCommit?.sha || priorCache.releaseBaseline.apiCommitSha,
      apiCommitMessage:
        apiCommit?.message || priorCache.releaseBaseline.apiCommitMessage,
    };

    const stories = mapGitHubIssuesToStories(
      ghResult.rawIssues,
      priorCache.stories || baseline.stories || [],
    );

    const infrastructure = await probeInfraImpl(baseline.infrastructure, {
      githubReachable: ghResult.reachable,
      mode,
      cacheAgeSeconds,
    });

    const payload = {
      snapshotMeta: {
        ...baseline.snapshotMeta,
        mode,
        capturedAt,
        capturedTimestampPST,
        buildVersion: `1.1.0-live.${releaseBaseline.latestCommitSha}`,
        isolationTier: "hybrid-lan-telemetry",
      },
      sourceStatus: {
        githubReachable: Boolean(ghResult.reachable),
        hostProbesActive: Boolean(agentProbeResult.hostProbesActive),
        cacheAgeSeconds,
        lastError: ghResult.error || null,
      },
      releaseBaseline,
      agents: agentProbeResult.agents,
      infrastructure,
      stories,
    };

    memoryCache = payload;
    lastCollectedAtMs = nowMs;

    // Only overwrite persistent disk cache on live capture or initial missing cache
    if (ghResult.reachable || !diskCache) {
      await writeDiskCacheAtomically(payload);
    }
    return payload;
  }

  async function getDashboardData({ forceRefresh = false } = {}) {
    const nowMs = Date.now();
    const ageSinceCollectMs =
      lastCollectedAtMs > 0 ? nowMs - lastCollectedAtMs : Infinity;

    const withinTtl = memoryCache && ageSinceCollectMs < ttlMs;
    const withinCooldown =
      memoryCache && ageSinceCollectMs < minRefreshCooldownMs;

    if (memoryCache && ((!forceRefresh && withinTtl) || withinCooldown)) {
      const capturedMs = Date.parse(memoryCache.snapshotMeta?.capturedAt ?? "");
      const cacheAgeSeconds = Number.isFinite(capturedMs)
        ? Math.max(0, Math.floor((nowMs - capturedMs) / 1000))
        : Math.max(0, Math.floor(ageSinceCollectMs / 1000));
      return {
        ...memoryCache,
        sourceStatus: {
          ...memoryCache.sourceStatus,
          cacheAgeSeconds,
        },
        infrastructure: updateDemoResilienceAge(
          memoryCache.infrastructure,
          memoryCache.sourceStatus?.githubReachable,
          memoryCache.snapshotMeta?.mode,
          cacheAgeSeconds,
        ),
      };
    }

    if (!inflightPromise) {
      inflightPromise = collectFresh().finally(() => {
        inflightPromise = null;
      });
    }

    try {
      return await inflightPromise;
    } catch (err) {
      if (memoryCache) {
        return memoryCache;
      }
      throw err;
    }
  }

  return {
    getDashboardData,
  };
}
