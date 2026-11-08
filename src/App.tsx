import React, { useState } from "react";
import {
  Shield,
  ShieldCheck,
  CheckCircle2,
  Cpu,
  Terminal,
  ShieldAlert,
  Code2,
  HardDrive,
  WifiOff,
  Server,
  Activity,
  Layers,
  ChevronRight,
  Lock,
} from "lucide-react";
import snapshotDataRaw from "./data/dashboard-snapshot.json";
import { DashboardData, AgentMember, InfrastructureMetric } from "./types.ts";

const snapshotData = snapshotDataRaw as DashboardData;

const agentIconMap: Record<string, React.ReactNode> = {
  Cpu: <Cpu className="w-5 h-5 text-blue-400" />,
  Terminal: <Terminal className="w-5 h-5 text-emerald-400" />,
  ShieldAlert: <ShieldAlert className="w-5 h-5 text-purple-400" />,
  Code2: <Code2 className="w-5 h-5 text-cyan-400" />,
};

export default function App() {
  const [selectedAgent, setSelectedAgent] = useState<AgentMember | null>(null);
  const [selectedMetric, setSelectedMetric] =
    useState<InfrastructureMetric | null>(null);

  const { snapshotMeta, releaseBaseline, agents, infrastructure } =
    snapshotData;

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col font-sans">
      {/* Top Banner: Offline Snapshot Mode */}
      <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 border-b border-blue-800/40 px-4 py-2.5 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="font-semibold tracking-wide text-blue-200">
              OFFLINE SNAPSHOT MODE
            </span>
            <span className="text-gray-400">—</span>
            <span className="text-gray-300 font-mono">
              Captured: {snapshotMeta.capturedTimestampPST}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-800/40">
              <WifiOff className="w-3.5 h-3.5" />
              <span>Zero Outbound Calls</span>
            </div>
            <div className="flex items-center gap-1.5 text-blue-300 bg-blue-950/60 px-2.5 py-1 rounded border border-blue-800/40">
              <Lock className="w-3.5 h-3.5" />
              <span>Zero Client Secrets</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className="border-b border-gray-800 bg-gray-900/60 backdrop-blur px-4 py-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/10 border border-blue-500/30 rounded-lg text-blue-400">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Nidavellir Mission Control
                </h1>
                <span className="text-xs font-mono bg-gray-800 text-gray-300 px-2 py-0.5 rounded border border-gray-700">
                  v{snapshotMeta.buildVersion}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
                Self-hosted operational dashboard for{" "}
                <span className="text-gray-200 font-medium">
                  manifesting.art
                </span>{" "}
                autonomous agent swarm
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-1.5">
              <span className="text-gray-400 block text-[10px] uppercase tracking-wider font-semibold">
                Host Node
              </span>
              <span className="text-gray-200 font-mono font-medium">
                Nidavellir (Debian 13)
              </span>
            </div>
            <div className="bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-1.5">
              <span className="text-gray-400 block text-[10px] uppercase tracking-wider font-semibold">
                Target LAN
              </span>
              <span className="text-gray-200 font-mono font-medium">
                192.168.68.64:3456
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Stats Row */}
      <div className="border-b border-gray-800/80 bg-gray-900/30 px-4 py-4 sm:px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-3.5 hover:border-gray-700 transition">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Integration Baseline</span>
              <Layers className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-white font-mono">
              {releaseBaseline.latestCommitSha}
            </div>
            <div className="text-xs text-emerald-400 mt-0.5 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{releaseBaseline.integrationBranch} Locked</span>
            </div>
          </div>

          <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-3.5 hover:border-gray-700 transition">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Vitest Verification</span>
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-emerald-400 font-mono">
              {releaseBaseline.testSuite.passed} /{" "}
              {releaseBaseline.testSuite.total}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              100% Pass Rate (0 Failures)
            </div>
          </div>

          <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-3.5 hover:border-gray-700 transition">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Autonomous Agents</span>
              <Terminal className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-white font-mono">
              {agents.length} Deployed
            </div>
            <div className="text-xs text-emerald-400 mt-0.5 font-medium">
              2 Active · 2 Standby
            </div>
          </div>

          <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-3.5 hover:border-gray-700 transition">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Security Assurance</span>
              <ShieldCheck className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-white font-mono">
              CSP Strict
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              Container read_only: true
            </div>
          </div>
        </div>
      </div>

      {/* Main 3-Panel Layout */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 sm:px-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panel 1: Release & PR Baseline */}
          <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-5 flex flex-col shadow-lg shadow-black/20">
            <div className="flex items-center justify-between pb-4 border-b border-gray-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Release & PR Baseline
                  </h2>
                  <p className="text-xs text-gray-400">
                    Integration branch and verification gates
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full">
                Verified
              </span>
            </div>

            <div className="mt-4 space-y-3">
              <div className="p-3 bg-gray-950/60 rounded-xl border border-gray-800 text-xs font-mono space-y-1.5">
                <div className="flex justify-between items-center text-gray-400">
                  <span>UI Repository</span>
                  <span className="text-gray-200 font-semibold">
                    {releaseBaseline.uiRepo}
                  </span>
                </div>
                <div className="flex justify-between items-center text-gray-400">
                  <span>API Repository</span>
                  <span className="text-gray-200 font-semibold">
                    {releaseBaseline.apiRepo}
                  </span>
                </div>
                <div className="flex justify-between items-center text-gray-400">
                  <span>Baseline Commit</span>
                  <span className="text-blue-400 bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-900/50">
                    {releaseBaseline.latestCommitSha}
                  </span>
                </div>
                <div className="pt-1.5 border-t border-gray-800/80 text-gray-400 text-[11px] truncate">
                  "{releaseBaseline.latestCommitMessage}"
                </div>
              </div>

              <div>
                <h3 className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-2">
                  Pre-Flight Automated Checks
                </h3>
                <div className="space-y-2">
                  {releaseBaseline.pipelineChecks.map((check, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 bg-gray-800/40 hover:bg-gray-800/70 border border-gray-800 rounded-lg text-xs transition"
                    >
                      <div className="flex items-center gap-2 text-gray-200">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="font-medium">{check.name}</span>
                      </div>
                      <span className="text-gray-400 font-mono text-[11px] bg-gray-900 px-1.5 py-0.5 rounded">
                        {check.duration}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <div className="p-3 bg-emerald-950/20 border border-emerald-900/40 rounded-xl flex items-center justify-between">
                  <div className="text-xs">
                    <span className="text-emerald-300 font-medium block">
                      Suite: {releaseBaseline.testSuite.framework}
                    </span>
                    <span className="text-gray-400 text-[11px]">
                      All 75 automated specs green
                    </span>
                  </div>
                  <span className="text-sm font-bold text-emerald-400 font-mono">
                    100%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Panel 2: Autonomous Agent Team */}
          <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-5 flex flex-col shadow-lg shadow-black/20">
            <div className="flex items-center justify-between pb-4 border-b border-gray-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg border border-purple-500/20">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Autonomous Agent Team
                  </h2>
                  <p className="text-xs text-gray-400">
                    Swarm agents and active assignments
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono bg-purple-950 text-purple-300 border border-purple-800 px-2 py-0.5 rounded-full">
                4 Agents
              </span>
            </div>

            <div className="mt-4 space-y-3 flex-1">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  className="p-3 bg-gray-800/40 hover:bg-gray-800/80 border border-gray-800 hover:border-gray-700 rounded-xl transition cursor-pointer group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-gray-900 rounded-lg border border-gray-800 group-hover:border-gray-700">
                        {agentIconMap[agent.avatarIcon] || (
                          <Terminal className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white group-hover:text-blue-300 transition">
                            {agent.callsign}
                          </span>
                          <span
                            className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded font-medium ${
                              agent.status === "active"
                                ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                                : "bg-gray-800 text-gray-400 border border-gray-700"
                            }`}
                          >
                            {agent.status}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400 block">
                          {agent.role}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-gray-300 transition" />
                  </div>

                  <div className="mt-2 text-xs bg-gray-950/50 p-2 rounded-lg border border-gray-800/60 font-mono">
                    <span className="text-gray-400 block text-[10px] uppercase font-semibold">
                      Active Focus
                    </span>
                    <span className="text-gray-300 truncate block">
                      {agent.currentFocus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Panel 3: System & Infrastructure Assurance */}
          <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-5 flex flex-col shadow-lg shadow-black/20">
            <div className="flex items-center justify-between pb-4 border-b border-gray-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Infrastructure Assurance
                  </h2>
                  <p className="text-xs text-gray-400">
                    Host, container, and network security
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full">
                Hardened
              </span>
            </div>

            <div className="mt-4 space-y-2.5 flex-1">
              {infrastructure.map((metric, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedMetric(metric)}
                  className="p-3 bg-gray-800/40 hover:bg-gray-800/80 border border-gray-800 hover:border-gray-700 rounded-xl transition cursor-pointer"
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-400 font-medium uppercase tracking-wider text-[10px]">
                      {metric.category}
                    </span>
                    <span
                      className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${
                        metric.status === "optimal"
                          ? "bg-blue-950 text-blue-300 border border-blue-800"
                          : "bg-emerald-950 text-emerald-300 border border-emerald-800"
                      }`}
                    >
                      {metric.status}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-white">
                    {metric.name}
                  </div>
                  <div className="text-xs font-mono text-gray-300 mt-0.5">
                    {metric.value}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1">
                    {metric.detail}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stories & Architecture Reference Drawer / Box */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
                Consensus User Stories Implementation Tracker
              </h3>
            </div>
            <span className="text-xs font-mono text-gray-400">
              Technical Consensus: Craig, Cereal Killer, Zero Cool, Antigravity
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <div className="p-2.5 bg-gray-950/60 border border-amber-900/40 rounded-xl">
              <div className="text-amber-400 font-mono font-bold">
                INFRA-001
              </div>
              <div className="text-gray-300 font-medium mt-0.5">
                Token Revocation
              </div>
              <div className="text-[10px] text-amber-500/90 mt-1">
                P0 · HELD (Craig)
              </div>
            </div>

            <div className="p-2.5 bg-gray-950/60 border border-emerald-900/40 rounded-xl">
              <div className="text-emerald-400 font-mono font-bold">
                INFRA-002
              </div>
              <div className="text-gray-300 font-medium mt-0.5">
                Offline SPA Scaffold
              </div>
              <div className="text-[10px] text-emerald-400 mt-1">
                P1 · Active Build
              </div>
            </div>

            <div className="p-2.5 bg-gray-950/60 border border-emerald-900/40 rounded-xl">
              <div className="text-emerald-400 font-mono font-bold">
                INFRA-003
              </div>
              <div className="text-gray-300 font-medium mt-0.5">
                Nginx Hardening & CSP
              </div>
              <div className="text-[10px] text-emerald-400 mt-1">
                P1 · Configured
              </div>
            </div>

            <div className="p-2.5 bg-gray-950/60 border border-blue-900/40 rounded-xl">
              <div className="text-blue-400 font-mono font-bold">INFRA-004</div>
              <div className="text-gray-300 font-medium mt-0.5">
                Docker Supervision
              </div>
              <div className="text-[10px] text-blue-400 mt-1">
                P1 · Composed
              </div>
            </div>

            <div className="p-2.5 bg-gray-950/60 border border-gray-800 rounded-xl">
              <div className="text-gray-400 font-mono font-bold">INFRA-005</div>
              <div className="text-gray-300 font-medium mt-0.5">
                Tablet & Outage UAT
              </div>
              <div className="text-[10px] text-gray-500 mt-1">
                P2 · Ready for Test
              </div>
            </div>

            <div className="p-2.5 bg-gray-950/60 border border-gray-800 rounded-xl">
              <div className="text-gray-400 font-mono font-bold">INFRA-006</div>
              <div className="text-gray-300 font-medium mt-0.5">
                Phase 2 Token Proxy
              </div>
              <div className="text-[10px] text-gray-500 mt-1">P3 · Backlog</div>
            </div>
          </div>
        </div>
      </main>

      {/* Modal Inspector for Agent details */}
      {selectedAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-800 rounded-xl border border-gray-700">
                  {agentIconMap[selectedAgent.avatarIcon] || (
                    <Terminal className="w-6 h-6 text-gray-300" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {selectedAgent.callsign}
                  </h3>
                  <span className="text-xs text-blue-400 font-medium">
                    {selectedAgent.role}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedAgent(null)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs font-mono bg-gray-950 p-4 rounded-xl border border-gray-800">
              <div className="flex justify-between">
                <span className="text-gray-500">Model Engine:</span>
                <span className="text-gray-200">{selectedAgent.model}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Runtime Env:</span>
                <span className="text-gray-200">{selectedAgent.runtime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Current Status:</span>
                <span className="text-emerald-400 uppercase font-semibold">
                  {selectedAgent.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Last Checkpoint:</span>
                <span className="text-gray-300">
                  {selectedAgent.lastCheckpoint}
                </span>
              </div>
              <div className="pt-2 border-t border-gray-800">
                <span className="text-gray-500 block mb-1">
                  Active Assignment:
                </span>
                <span className="text-gray-300 font-sans">
                  {selectedAgent.currentFocus}
                </span>
              </div>
            </div>

            <button
              onClick={() => setSelectedAgent(null)}
              className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-medium transition"
            >
              Close Inspector
            </button>
          </div>
        </div>
      )}

      {/* Modal Inspector for Metric details */}
      {selectedMetric && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[11px] text-gray-400 uppercase font-semibold tracking-wider">
                    {selectedMetric.category}
                  </span>
                  <h3 className="text-lg font-bold text-white">
                    {selectedMetric.name}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedMetric(null)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 bg-gray-950 p-4 rounded-xl border border-gray-800">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-gray-500">State / Value:</span>
                <span className="text-emerald-400 font-semibold">
                  {selectedMetric.value}
                </span>
              </div>
              <div className="text-xs text-gray-300 font-sans">
                <span className="text-gray-500 block text-[11px] font-mono uppercase mb-1">
                  Assurance Detail:
                </span>
                {selectedMetric.detail}
              </div>
            </div>

            <button
              onClick={() => setSelectedMetric(null)}
              className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-medium transition"
            >
              Close Inspector
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-gray-800/80 bg-gray-950 py-4 px-4 sm:px-6 text-xs text-gray-500">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span>Nidavellir Host Node</span>
            <span>·</span>
            <span>Debian 13 (trixie)</span>
            <span>·</span>
            <span>Kernel 6.12</span>
            <span>·</span>
            <span>systemd PID 1</span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span>Spec: Candidate v3 (Consensus Signed)</span>
            <span>·</span>
            <span>Target: 192.168.68.64:3456</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
