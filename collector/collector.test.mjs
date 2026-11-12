import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createCollectorManager,
  mapGitHubIssuesToStories,
  probeGitHubUpstream,
  probeNidavellirAgents,
  sanitizeError,
} from "./probes.mjs";
import { createCollectorServer } from "./server.mjs";

test("sanitizeError redacts GitHub tokens, Bearer/token headers, and env GITHUB_TOKEN", () => {
  const prev = process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = "customSecretTokenValue999";
  try {
    const leaked =
      "Failed with gho_1234567890abcdefghijklmnopqrstuv, token abcdef12345, Bearer ghp_secretToken999, and customSecretTokenValue999";
    const cleaned = sanitizeError(new Error(leaked));
    assert.ok(!cleaned.includes("gho_123456"));
    assert.ok(!cleaned.includes("ghp_secretToken999"));
    assert.ok(!cleaned.includes("abcdef12345"));
    assert.ok(!cleaned.includes("customSecretTokenValue999"));
    assert.ok(cleaned.includes("[REDACTED]"));
  } finally {
    if (prev === undefined) {
      delete process.env.GITHUB_TOKEN;
    } else {
      process.env.GITHUB_TOKEN = prev;
    }
  }
});

test("probeGitHubUpstream requires all 3 endpoints for reachable=true and handles partial failure", async () => {
  const seenHeaders = [];
  const fullOkFetch = async (url, opts) => {
    seenHeaders.push(opts.headers);
    if (url.includes("/manifesting-ui/")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          sha: "1111111abcdef",
          commit: { message: "ui subject\nbody" },
        }),
      };
    }
    if (url.includes("/manifesting-api/")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          sha: "2222222abcdef",
          commit: { message: "api subject\nbody" },
        }),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => [
        { number: 1, title: "INFRA-001: Test", state: "open" },
      ],
    };
  };

  const resFull = await probeGitHubUpstream({
    githubToken: "   ",
    fetchImpl: fullOkFetch,
  });
  assert.equal(resFull.reachable, true);
  assert.equal(resFull.partial, true);
  assert.equal(resFull.uiCommit.sha, "1111111");
  assert.equal(resFull.apiCommit.sha, "2222222");
  assert.equal(resFull.error, null);
  assert.equal(seenHeaders[0].Authorization, undefined);

  // Partial failure: UI succeeds, API & Issues return 403 rate limit
  const partialFetch = async (url) => {
    if (url.includes("/manifesting-ui/")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          sha: "3333333abcdef",
          commit: { message: "partial ui" },
        }),
      };
    }
    return { ok: false, status: 403, json: async () => ({}) };
  };

  const resPartial = await probeGitHubUpstream({
    githubToken: "ghp_validToken123",
    fetchImpl: partialFetch,
  });
  assert.equal(resPartial.reachable, false);
  assert.equal(resPartial.partial, true);
  assert.equal(resPartial.uiCommit.sha, "3333333");
  assert.equal(resPartial.apiCommit, null);
  assert.match(resPartial.error, /GitHub HTTP 403/);
});

test("mapGitHubIssuesToStories preserves baseline status and maps closed issues to complete", () => {
  const fallback = [
    {
      key: "INFRA-007",
      title: "Live Data Fetching Epic",
      priority: "P1",
      status: "complete",
      summary: "Replaces static snapshot",
    },
  ];
  const raw = [
    {
      number: 7,
      title: "INFRA-007: Live Data Fetching",
      state: "open",
      body: "### Priority: P1 - High",
    },
    {
      number: 2,
      title: "INFRA-002: Offline SPA Scaffold",
      state: "closed",
      body: "### Priority: P1 - High",
    },
    {
      number: 99,
      title: "Some PR",
      state: "open",
      pull_request: { url: "https://api.github.com/..." },
    },
  ];
  const stories = mapGitHubIssuesToStories(raw, fallback);
  assert.equal(stories.length, 2);
  assert.equal(stories[0].key, "INFRA-002");
  assert.equal(stories[0].status, "complete");
  assert.equal(stories[1].key, "INFRA-007");
  assert.equal(stories[1].status, "complete");
  assert.equal(stories[1].priority, "P1");
});

test("probeNidavellirAgents reflects live socket and directory health", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "nid-agent-test-"));
  const socksDir = path.join(tmpDir, "socks");
  await fs.mkdir(socksDir, { recursive: true });
  await fs.writeFile(path.join(socksDir, "worker-1.sock"), "");

  const baseline = [
    {
      id: "antigravity",
      callsign: "Antigravity",
      role: "Lead",
      model: "Gemini",
      runtime: "Host",
      status: "standby",
      currentFocus: "Old",
      lastCheckpoint: "Old",
      avatarIcon: "Cpu",
    },
    {
      id: "codex",
      callsign: "Codex",
      role: "Peer",
      model: "Codex",
      runtime: "Socket",
      status: "standby",
      currentFocus: "Old",
      lastCheckpoint: "Old",
      avatarIcon: "Code2",
    },
  ];

  const res = await probeNidavellirAgents(baseline, {
    nidavellirRoot: tmpDir,
    zeroCoolDir: path.join(tmpDir, "missing"),
    codexSocketsDir: socksDir,
    tcpProbeImpl: async () => false,
  });

  assert.equal(res.hostProbesActive, true);
  assert.equal(res.agents[0].status, "active");
  assert.equal(res.agents[1].status, "idle");
  assert.match(res.agents[1].currentFocus, /1 active socket/);

  await fs.rm(tmpDir, { recursive: true, force: true });
});

test("createCollectorManager handles live mode, local-git during WAN outage (cached mode), cold-start disk cache, and single-flight deduplication", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "nid-mgr-test-"));
  const cacheFile = path.join(tmpDir, "cache.json");

  let githubCalls = 0;
  let shouldFailGitHub = false;

  const manager = createCollectorManager({
    cacheFilePath: cacheFile,
    ttlMs: 60_000,
    minRefreshCooldownMs: 0,
    uiRepoDir: "/fake/ui",
    apiRepoDir: "/fake/api",
    probeGitHubImpl: async () => {
      githubCalls++;
      await new Promise((r) => setTimeout(r, 15));
      if (shouldFailGitHub) {
        return {
          reachable: false,
          partial: false,
          uiCommit: null,
          apiCommit: null,
          rawIssues: null,
          error: "Simulated Starlink outage",
        };
      }
      return {
        reachable: true,
        partial: true,
        uiCommit: { sha: "abc1234", message: "feat: live ui commit" },
        apiCommit: { sha: "def5678", message: "feat: live api commit" },
        rawIssues: [],
        error: null,
      };
    },
    probeGitImpl: async (dir) =>
      dir.includes("ui")
        ? { sha: "loc1111", message: "local ui" }
        : { sha: "loc2222", message: "local api" },
  });

  // 1. Single-flight deduplication: 2 concurrent calls trigger only 1 upstream probe
  const [data1, data1Dup] = await Promise.all([
    manager.getDashboardData({ forceRefresh: true }),
    manager.getDashboardData({ forceRefresh: true }),
  ]);
  assert.equal(githubCalls, 1);
  assert.equal(data1.snapshotMeta.mode, "live");
  assert.equal(data1.releaseBaseline.latestCommitSha, "abc1234");
  assert.equal(data1Dup.releaseBaseline.latestCommitSha, "abc1234");

  // 2. Second call within TTL returns cached payload without calling GitHub
  const data2 = await manager.getDashboardData();
  assert.equal(githubCalls, 1);
  assert.equal(data2.releaseBaseline.latestCommitSha, "abc1234");

  // 3. Forced refresh during Starlink outage with local git present still sets mode="cached"
  shouldFailGitHub = true;
  const data3 = await manager.getDashboardData({ forceRefresh: true });
  assert.equal(githubCalls, 2);
  assert.equal(data3.snapshotMeta.mode, "cached");
  assert.equal(data3.sourceStatus.githubReachable, false);
  assert.equal(data3.sourceStatus.lastError, "Simulated Starlink outage");

  // 4. Cold-start new manager instance during outage recovers from disk cache and computes cacheAgeSeconds
  const savedDisk = JSON.parse(await fs.readFile(cacheFile, "utf8"));
  savedDisk.snapshotMeta.capturedAt = new Date(
    Date.now() - 120_000,
  ).toISOString();
  await fs.writeFile(cacheFile, JSON.stringify(savedDisk));

  const coldManager = createCollectorManager({
    cacheFilePath: cacheFile,
    ttlMs: 60_000,
    minRefreshCooldownMs: 0,
    uiRepoDir: "",
    apiRepoDir: "",
    probeGitHubImpl: async () => ({
      reachable: false,
      partial: false,
      uiCommit: null,
      apiCommit: null,
      rawIssues: null,
      error: "Cold-start WAN down",
    }),
    probeGitImpl: async () => null,
  });

  const coldData = await coldManager.getDashboardData();
  assert.equal(coldData.snapshotMeta.mode, "cached");
  assert.equal(coldData.releaseBaseline.latestCommitSha, "abc1234");
  assert.ok(coldData.sourceStatus.cacheAgeSeconds >= 115);

  await fs.rm(tmpDir, { recursive: true, force: true });
});

test("createCollectorServer normalizes paths, enforces URL length limit, sets CSP, and rejects POST", async () => {
  const fakeManager = {
    getDashboardData: async ({ forceRefresh }) => ({
      snapshotMeta: {
        mode: forceRefresh ? "live" : "cached",
        capturedAt: "2026-11-11T23:00:00Z",
        capturedTimestampPST: "2026-11-11 15:00 PST",
        nodeEnv: "test",
        buildVersion: "1.1.0-test",
        isolationTier: "hybrid-lan-telemetry",
      },
    }),
  };

  const server = createCollectorServer(fakeManager);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const healthRes = await fetch(`${baseUrl}/api/health/`);
    assert.equal(healthRes.status, 200);
    assert.equal(healthRes.headers.get("x-content-type-options"), "nosniff");
    assert.match(
      healthRes.headers.get("content-security-policy") || "",
      /default-src 'none'/,
    );
    assert.equal(
      healthRes.headers.get("cache-control"),
      "no-store, no-cache, must-revalidate",
    );

    const dashRes = await fetch(`${baseUrl}/api//dashboard/?refresh=1`);
    assert.equal(dashRes.status, 200);
    const dashBody = await dashRes.json();
    assert.equal(dashBody.snapshotMeta.mode, "live");

    const longUrlRes = await fetch(
      `${baseUrl}/api/dashboard?pad=${"x".repeat(300)}`,
    );
    assert.equal(longUrlRes.status, 414);

    const postRes = await fetch(`${baseUrl}/api/dashboard`, { method: "POST" });
    assert.equal(postRes.status, 405);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
