export interface ReleaseBaseline {
  uiRepo: string;
  apiRepo: string;
  integrationBranch: string;
  latestCommitSha: string;
  latestCommitMessage: string;
  apiCommitSha?: string;
  apiCommitMessage?: string;
  testSuite: {
    framework: string;
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    coveragePercent: number;
  };
  pipelineChecks: Array<{
    name: string;
    status: "passed" | "failed" | "running";
    duration: string;
  }>;
}

export interface AgentMember {
  id: string;
  callsign: string;
  role: string;
  model: string;
  runtime: string;
  status: "active" | "idle" | "standby";
  currentFocus: string;
  lastCheckpoint: string;
  avatarIcon: string;
}

export interface InfrastructureMetric {
  category: string;
  name: string;
  value: string;
  status: "healthy" | "optimal" | "warning";
  detail: string;
}

export interface DashboardData {
  snapshotMeta: {
    mode: "offline_snapshot";
    capturedAt: string;
    capturedTimestampPST: string;
    nodeEnv: string;
    buildVersion: string;
    isolationTier: string;
  };
  releaseBaseline: ReleaseBaseline;
  agents: AgentMember[];
  infrastructure: InfrastructureMetric[];
}
