"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Bot, Cpu, HardDrive, Activity, Settings, Shield, Terminal,
  RefreshCw, Power, Wifi, WifiOff, ChevronRight, Send,
  Zap, Users, MessageSquare, Clock, MemoryStick, Server,
  Eye, EyeOff, Wrench, CheckCircle2, XCircle, AlertTriangle,
  Loader2, ArrowUpCircle, Globe, Hash, Code2, Layers,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════
interface BotStatus {
  ram: { total: number; free: number; used: number; process: number; heapUsed: number; heapTotal: number; percentage: number; processPercentage: number };
  cpu: { model: string; cores: number; speed: number };
  bot: { name: string; uptime: number; uptimeFormatted: string; pluginCount: number; userCount: number; groupCount: number; version: string; platform: string; ownerName: string; ownerNumber: string; prefix: string; isPublic: boolean };
  system: { platform: string; arch: string; hostname: string; nodeVersion: string; uptime: number };
}

interface SelfHealEvent {
  type: string;
  timestamp: number;
  [key: string]: any;
}

interface LogEntry {
  time: string;
  type: "INFO" | "WARN" | "ERR" | "SUCC" | "FIX" | "TEST";
  source: string;
  text: string;
}

interface PlanStep {
  id: number;
  label: string;
  status: "pending" | "loading" | "done" | "error";
  detail?: string;
}

interface Plan {
  id: string;
  title: string;
  steps: PlanStep[];
  status: "active" | "completed" | "failed";
  createdAt: number;
}

interface BotSettings {
  botName: string;
  ownerName: string;
  prefix: string;
  isPublic: boolean;
  autoTyping: boolean;
  antiSpam: boolean;
  autoSticker: boolean;
  selfHealEnabled: boolean;
  selfHealAutoFix: boolean;
  selfHealTimeout: number;
  selfHealMaxCycles: number;
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
const formatBytes = (bytes: number) => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
};

const formatUptime = (ms: number) => {
  if (!ms || ms <= 0) return "0s";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor(ms / 3600000) % 24;
  const m = Math.floor(ms / 60000) % 60;
  const s = Math.floor(ms / 1000) % 60;
  const p: string[] = [];
  if (d > 0) p.push(`${d}d`);
  if (h > 0) p.push(`${h}h`);
  if (m > 0) p.push(`${m}m`);
  p.push(`${s}s`);
  return p.join(" ");
};

const getTime = () => {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
};

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export default function HertaDashboard() {
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("selfheal-dashboard");
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "selfheal" | "settings" | "terminal">("overview");
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [settings, setSettings] = useState<BotSettings | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [events, setEvents] = useState<SelfHealEvent[]>([]);
  const [commandInput, setCommandInput] = useState("");
  const [commandOutput, setCommandOutput] = useState<string[]>(["> Dashboard ready. Connect to bot to start."]);
  const [showApiConfig, setShowApiConfig] = useState(true);
  const [selfHealStatus, setSelfHealStatus] = useState<any>(null);

  const logEndRef = useRef<HTMLDivElement>(null);
  const cmdEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // ── API Fetch Helper ──
  const apiFetch = useCallback(
    async (path: string, opts: RequestInit = {}) => {
      if (!apiUrl) throw new Error("Not configured");
      const url = `${apiUrl}/api/dashboard${path}${path.includes("?") ? "&" : "?"}key=${apiKey}`;
      const res = await fetch(url, {
        ...opts,
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey, ...opts.headers },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    [apiUrl, apiKey]
  );

  // ── Connect to Bot ──
  const connectToBot = useCallback(async () => {
    if (!apiUrl) return;
    setConnecting(true);
    try {
      const data = await apiFetch("/stats");
      setStatus(data);
      setConnected(true);
      setShowApiConfig(false);
      setLogs((p) => [...p, { time: getTime(), type: "SUCC", source: "SYS", text: `Connected to ${data.bot.name}` }]);

      // Load settings
      try {
        const s = await apiFetch("/settings");
        setSettings(s);
      } catch {}

      // Load self-heal status
      try {
        const sh = await apiFetch("/selfheal/status");
        setSelfHealStatus(sh);
      } catch {}

      // Load activity logs
      try {
        const logData = await apiFetch("/logs");
        if (Array.isArray(logData)) {
          setLogs((p) => [...p, ...logData.map((l: any) => ({
            time: new Date(l.time).toLocaleTimeString("id-ID"),
            type: l.type as LogEntry["type"],
            source: l.source,
            text: l.text,
          }))]);
        }
      } catch {}

      // Start SSE
      if (eventSourceRef.current) eventSourceRef.current.close();
      const es = new EventSource(`${apiUrl}/api/dashboard/events?key=${apiKey}`);
      es.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.event === "connected") {
            setLogs((p) => [...p, { time: getTime(), type: "SUCC", source: "SSE", text: "Real-time stream connected" }]);
          } else if (msg.event === "log") {
            const l = msg.data;
            setLogs((p) => [...p.slice(-99), { time: new Date(l.time).toLocaleTimeString("id-ID"), type: l.type, source: l.source, text: l.text }]);
          } else if (msg.event === "plan" || msg.event === "plan_update") {
            // Refresh plans
            apiFetch("/plans").then((p: Plan[]) => setPlans(p)).catch(() => {});
          } else if (msg.event === "setting_change") {
            setLogs((p) => [...p, { time: getTime(), type: "INFO", source: "SSE", text: `Setting changed: ${msg.data.key} = ${msg.data.value}` }]);
          } else if (msg.event === "restart") {
            setLogs((p) => [...p, { time: getTime(), type: "WARN", source: "SSE", text: "Bot restarting..." }]);
            setConnected(false);
          }
        } catch {}
      };
      es.onerror = () => {
        setLogs((p) => [...p, { time: getTime(), type: "WARN", source: "SSE", text: "Stream interrupted, reconnecting..." }]);
      };
      eventSourceRef.current = es;

      // Start polling
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const d = await apiFetch("/stats");
          setStatus(d);
        } catch {
          setConnected(false);
        }
      }, 10000);
    } catch (err: any) {
      setLogs((p) => [...p, { time: getTime(), type: "ERR", source: "SYS", text: `Connection failed: ${err.message}` }]);
      setConnected(false);
    } finally {
      setConnecting(false);
    }
  }, [apiUrl, apiKey, apiFetch]);

  // ── Send Command ──
  const sendCommand = async () => {
    if (!commandInput.trim() || !connected) return;
    const cmd = commandInput.trim();
    setCommandInput("");
    setCommandOutput((p) => [...p, `> ${cmd}`]);

    try {
      const data = await apiFetch("/selfheal/fix", {
        method: "POST",
        body: JSON.stringify({ command: cmd, description: cmd }),
      });
      setCommandOutput((p) => [...p, `  ${data.success ? "✅" : "❌"} ${data.message}`]);
      if (data.planId) {
        setCommandOutput((p) => [...p, `  📋 Plan: ${data.planId}`]);
      }
    } catch (err: any) {
      setCommandOutput((p) => [...p, `  ❌ Error: ${err.message}`]);
    }
  };

  // ── Toggle Self-Heal ──
  const toggleSelfHeal = async () => {
    try {
      const data = await apiFetch("/selfheal/toggle", { method: "POST" });
      setSettings((p) => (p ? { ...p, selfHealEnabled: data.enabled } : p));
      setLogs((p) => [...p, { time: getTime(), type: "SUCC", source: "Dashboard", text: `Self-Heal ${data.enabled ? "enabled" : "disabled"}` }]);
    } catch {}
  };

  // ── Update Setting ──
  const updateSetting = async (key: string, value: any) => {
    try {
      await apiFetch("/settings", { method: "POST", body: JSON.stringify({ [key]: value }) });
      setSettings((p) => (p ? { ...p, [key]: value } : p));
      setLogs((p) => [...p, { time: getTime(), type: "SUCC", source: "Dashboard", text: `Updated ${key}` }]);
    } catch {}
  };

  // ── Restart Bot ──
  const restartBot = async () => {
    if (!confirm("Restart bot?")) return;
    try {
      await apiFetch("/restart", { method: "POST" });
      setLogs((p) => [...p, { time: getTime(), type: "WARN", source: "Dashboard", text: "Bot restarting..." }]);
      setConnected(false);
    } catch {}
  };

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    cmdEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [commandOutput]);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#06070a] text-[#c9d1d9] flex flex-col">
      {/* ── TOP BAR ── */}
      <header className="h-14 border-b border-[#30363d] bg-[#0d1117] flex items-center px-4 gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${connected ? "bg-[#00e676] shadow-[0_0_8px_#00e676]" : "bg-[#ff1744] shadow-[0_0_8px_#ff1744]"} transition-all`} />
          <Bot className="w-5 h-5 text-[#00e5ff]" />
          <span className="font-bold text-sm text-white">{status?.bot?.name || "Herta V3"}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00e5ff]/10 text-[#00e5ff] border border-[#00e5ff]/30 font-mono">
            v{status?.bot?.version || "3.0"}
          </span>
        </div>
        <div className="flex-1" />
        {connected && status && (
          <div className="hidden md:flex items-center gap-4 text-xs text-[#8b949e]">
            <div className="flex items-center gap-1"><Clock className="w-3 h-3" /> {status.bot.uptimeFormatted || formatUptime(status.bot.uptime)}</div>
            <div className="flex items-center gap-1"><MemoryStick className="w-3 h-3" /> {formatBytes(status.ram.process)}</div>
            <div className="flex items-center gap-1"><Users className="w-3 h-3" /> {status.bot.userCount}</div>
            <div className="flex items-center gap-1"><Layers className="w-3 h-3 text-[#00e676]" /> {status.bot.pluginCount} plugins</div>
          </div>
        )}
        <button onClick={() => setShowApiConfig(!showApiConfig)} className="p-1.5 rounded hover:bg-[#21262d] transition-colors">
          <Settings className="w-4 h-4 text-[#8b949e]" />
        </button>
      </header>

      {/* ── API CONFIG PANEL ── */}
      {showApiConfig && (
        <div className="border-b border-[#30363d] bg-[#010409] p-4 animate-slide-up">
          <div className="max-w-2xl mx-auto flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-[10px] uppercase text-[#8b949e] font-bold mb-1 block">Bot API URL</label>
              <input
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://your-bot.herokuapp.com"
                className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm outline-none focus:border-[#00e5ff] transition-colors"
              />
            </div>
            <div className="w-full sm:w-48">
              <label className="text-[10px] uppercase text-[#8b949e] font-bold mb-1 block">API Key</label>
              <input
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                type="password"
                className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm outline-none focus:border-[#00e5ff] transition-colors"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={connectToBot}
                disabled={connecting || !apiUrl}
                className="px-6 py-2 rounded font-bold text-sm bg-[#00e5ff] text-black hover:bg-[#00b8d4] disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                {connecting ? "Connecting..." : "Connect"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── SIDEBAR ── */}
        <nav className="w-14 md:w-48 bg-[#0d1117] border-r border-[#30363d] flex flex-col py-2 shrink-0">
          {([
            { id: "overview", icon: Activity, label: "Overview" },
            { id: "selfheal", icon: Shield, label: "Self-Heal AI" },
            { id: "terminal", icon: Terminal, label: "Command" },
            { id: "settings", icon: Settings, label: "Settings" },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-all ${
                activeTab === tab.id
                  ? "text-[#00e5ff] bg-[#00e5ff]/10 border-r-2 border-[#00e5ff]"
                  : "text-[#8b949e] hover:text-white hover:bg-[#21262d]"
              }`}
            >
              <tab.icon className="w-4 h-4 shrink-0" />
              <span className="hidden md:block">{tab.label}</span>
            </button>
          ))}
          <div className="flex-1" />
          {connected && (
            <button onClick={restartBot} className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#ff6b6b] hover:bg-[#ff1744]/10 transition-all">
              <Power className="w-4 h-4 shrink-0" />
              <span className="hidden md:block">Restart</span>
            </button>
          )}
        </nav>

        {/* ── CONTENT AREA ── */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {!connected && !showApiConfig && (
            <div className="flex flex-col items-center justify-center h-full text-[#8b949e]">
              <WifiOff className="w-12 h-12 mb-4" />
              <p className="text-lg font-semibold">Not Connected</p>
              <p className="text-sm mt-1">Configure bot API URL to connect</p>
              <button onClick={() => setShowApiConfig(true)} className="mt-4 px-4 py-2 bg-[#21262d] rounded text-sm hover:bg-[#30363d]">
                Configure
              </button>
            </div>
          )}

          {/* ═══ OVERVIEW TAB ═══ */}
          {activeTab === "overview" && connected && status && (
            <div className="space-y-6 animate-slide-up">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={<Clock className="w-5 h-5 text-[#00e5ff]" />} label="Uptime" value={status.bot.uptimeFormatted || formatUptime(status.bot.uptime)} />
                <StatCard icon={<MemoryStick className="w-5 h-5 text-[#ff9800]" />} label="RAM Usage" value={`${formatBytes(status.ram.process)}`} sub={`Heap: ${formatBytes(status.ram.heapUsed)}/${formatBytes(status.ram.heapTotal)}`} />
                <StatCard icon={<Layers className="w-5 h-5 text-[#00e676]" />} label="Plugins" value={String(status.bot.pluginCount)} />
                <StatCard icon={<Users className="w-5 h-5 text-[#e040fb]" />} label="Users" value={String(status.bot.userCount)} sub={`${status.bot.groupCount} groups`} />
              </div>

              {/* Bot Info + RAM Chart */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Bot Info */}
                <div className="glass-panel rounded-xl p-5">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <Bot className="w-4 h-4 text-[#00e5ff]" /> Bot Information
                  </h3>
                  <div className="space-y-3 text-sm">
                    <InfoRow label="Name" value={status.bot.name} />
                    <InfoRow label="Number" value={status.bot.ownerNumber || "N/A"} />
                    <InfoRow label="Owner" value={status.bot.ownerName} />
                    <InfoRow label="Prefix" value={status.bot.prefix} />
                    <InfoRow label="Mode" value={status.bot.isPublic ? "Public" : "Self"} color={status.bot.isPublic ? "#00e676" : "#ff9800"} />
                    <InfoRow label="Platform" value={status.bot.platform} />
                    <InfoRow label="Version" value={`v${status.bot.version}`} />
                    <InfoRow label="Node.js" value={status.system.nodeVersion} />
                    <InfoRow label="System" value={`${status.system.platform} ${status.system.arch}`} />
                  </div>
                </div>

                {/* RAM Visual */}
                <div className="glass-panel rounded-xl p-5">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-[#ff9800]" /> Memory Dashboard
                  </h3>
                  <div className="space-y-4">
                    <RAMBar label="Process RSS" used={Math.round(status.ram.process / 1048576)} total={Math.round(status.ram.total / 1048576)} color="#00e5ff" />
                    <RAMBar label="Heap Used" used={Math.round(status.ram.heapUsed / 1048576)} total={Math.round(status.ram.heapTotal / 1048576)} color="#00e676" />
                    <RAMBar label="System RAM" used={Math.round(status.ram.used / 1048576)} total={Math.round(status.ram.total / 1048576)} color="#ff9800" />
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#30363d] grid grid-cols-2 gap-2 text-xs text-[#8b949e]">
                    <div>CPU: <span className="text-[#00e5ff]">{status.cpu.cores} cores</span></div>
                    <div>RAM: <span className="text-[#ff9800]">{status.ram.percentage}%</span></div>
                    {selfHealStatus && <>
                      <div>Self-Heal: <span className={selfHealStatus.enabled ? "text-[#00e676]" : "text-[#ff1744]"}>{selfHealStatus.enabled ? "ON" : "OFF"}</span></div>
                      <div>AutoFix: <span className={selfHealStatus.autoFix ? "text-[#00e676]" : "text-[#8b949e]"}>{selfHealStatus.autoFix ? "ON" : "OFF"}</span></div>
                    </>}
                  </div>
                </div>
              </div>

              {/* Activity Log */}
              <div className="glass-panel rounded-xl p-5">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#00e5ff]" /> Activity Log
                </h3>
                <div className="max-h-[200px] overflow-y-auto font-mono text-xs space-y-1">
                  {logs.slice(-30).map((l, i) => (
                    <div key={i} className="flex gap-2 py-0.5 border-b border-white/5">
                      <span className="text-[#8b949e] shrink-0">{l.time}</span>
                      <span className={`shrink-0 font-bold ${l.type === "SUCC" ? "text-[#00e676]" : l.type === "ERR" ? "text-[#ff1744]" : l.type === "WARN" ? "text-[#ff9800]" : l.type === "FIX" ? "text-[#e040fb]" : "text-[#00e5ff]"}`}>
                        {l.source}
                      </span>
                      <span className="text-[#c9d1d9]">{l.text}</span>
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              </div>
            </div>
          )}

          {/* ═══ SELF-HEAL TAB ═══ */}
          {activeTab === "selfheal" && connected && (
            <div className="space-y-6 animate-slide-up">
              {/* Self-Heal Header */}
              <div className="glass-panel rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Shield className="w-5 h-5 text-[#00e5ff]" /> Self-Heal AI Agent V4
                  </h3>
                  <button onClick={toggleSelfHeal} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${settings?.selfHealEnabled ? "bg-[#00e676]/20 text-[#00e676] border border-[#00e676]/40 hover:bg-[#00e676]/30" : "bg-[#ff1744]/20 text-[#ff1744] border border-[#ff1744]/40 hover:bg-[#ff1744]/30"}`}>
                    {settings?.selfHealEnabled ? "Enabled" : "Disabled"}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <AgentCard emoji="🔍" name="Mistral" role="Analyst" desc="Error diagnosis" active={!!selfHealStatus?.aiAgents?.analyst?.status?.includes("✅")} />
                  <AgentCard emoji="🔧" name="Cohere" role="Fixer" desc="Code generation" active={!!selfHealStatus?.aiAgents?.fixer?.status?.includes("✅")} />
                  <AgentCard emoji="🧪" name="OpenRouter" role="Tester" desc="Validation" active={!!selfHealStatus?.aiAgents?.tester?.status?.includes("✅")} />
                </div>
              </div>

              {/* Pipeline Visualization */}
              <div className="glass-panel rounded-xl p-5">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <ArrowUpCircle className="w-4 h-4 text-[#00e5ff]" /> Fix Pipeline
                </h3>
                <div className="flex items-center gap-3 mb-4 text-xs text-[#8b949e]">
                  <span>Error Detected</span>
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-[#00e5ff]">Analyst</span>
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-[#ff9800]">Fixer</span>
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-[#00e676]">Tester</span>
                  <ChevronRight className="w-3 h-3" />
                  <span>Auto-Save</span>
                </div>
                <div className="text-xs text-[#8b949e]">
                  Active Sessions: {selfHealStatus?.activeSessions || 0} | Pending: {selfHealStatus?.pendingNotifications || 0} | Max Cycles: {selfHealStatus?.maxCycles || 3}
                </div>
              </div>

              {/* Self-Heal Events */}
              <div className="glass-panel rounded-xl p-5">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-400" /> Recent Events
                </h3>
                <div className="max-h-[300px] overflow-y-auto space-y-2">
                  {events.length === 0 && <p className="text-xs text-[#8b949e]">No events yet. Errors will appear here when detected.</p>}
                  {events.slice(-20).reverse().map((ev, i) => (
                    <div key={i} className="flex items-start gap-3 p-2 rounded bg-[#010409] border border-[#21262d]">
                      <div className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${ev.type === "fix_started" ? "bg-[#00e5ff]" : ev.type === "toggle" ? "bg-[#ff9800]" : ev.type === "settings_updated" ? "bg-[#00e676]" : ev.type === "restart" ? "bg-[#ff1744]" : "bg-[#8b949e]"}`} />
                      <div className="flex-1 text-xs">
                        <div className="text-[#c9d1d9] font-mono">{ev.type}</div>
                        <div className="text-[#8b949e] mt-0.5">{new Date(ev.timestamp).toLocaleString("id-ID")}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ TERMINAL TAB ═══ */}
          {activeTab === "terminal" && connected && (
            <div className="space-y-4 animate-slide-up h-full flex flex-col">
              <div className="glass-panel rounded-xl p-5 flex-1 flex flex-col">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-[#00e676]" /> Command Terminal
                </h3>
                <p className="text-xs text-[#8b949e] mb-3">
                  Send commands to the bot. Example: <code className="text-[#00e5ff]">perbaiki fitur twitter</code>
                </p>
                <div className="flex-1 bg-[#010409] border border-[#30363d] rounded-lg p-4 font-mono text-xs overflow-y-auto min-h-[300px]">
                  {commandOutput.map((line, i) => (
                    <div key={i} className={`mb-1 ${line.startsWith(">") ? "text-[#00e5ff]" : line.includes("✅") ? "text-[#00e676]" : line.includes("❌") ? "text-[#ff1744]" : "text-[#8b949e]"}`}>
                      {line}
                    </div>
                  ))}
                  <div ref={cmdEndRef} />
                </div>
                <div className="flex gap-2 mt-3">
                  <input
                    value={commandInput}
                    onChange={(e) => setCommandInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendCommand()}
                    placeholder="perbaiki fitur twitter..."
                    className="flex-1 bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-sm outline-none focus:border-[#00e5ff] font-mono"
                  />
                  <button onClick={sendCommand} className="px-4 py-2 bg-[#00e5ff] text-black rounded font-bold text-sm hover:bg-[#00b8d4] flex items-center gap-2">
                    <Send className="w-4 h-4" /> Send
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ═══ SETTINGS TAB ═══ */}
          {activeTab === "settings" && connected && settings && (
            <div className="space-y-6 animate-slide-up">
              <div className="glass-panel rounded-xl p-5">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-[#00e5ff]" /> Bot Settings
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SettingInput label="Bot Name" value={settings.botName} onChange={(v) => updateSetting("botName", v)} />
                  <SettingInput label="Owner Name" value={settings.ownerName} onChange={(v) => updateSetting("ownerName", v)} />
                  <SettingInput label="Prefix" value={settings.prefix} onChange={(v) => updateSetting("prefix", v)} />
                </div>
              </div>

              <div className="glass-panel rounded-xl p-5">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#00e676]" /> Feature Toggles
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <ToggleSetting label="Public Mode" value={settings.isPublic} onChange={(v) => updateSetting("isPublic", v)} desc="Allow everyone to use bot" />
                  <ToggleSetting label="Anti Spam" value={settings.antiSpam} onChange={(v) => updateSetting("antiSpam", v)} desc="Block spammers automatically" />
                  <ToggleSetting label="Auto Typing" value={settings.autoTyping} onChange={(v) => updateSetting("autoTyping", v)} desc="Show typing indicator" />
                  <ToggleSetting label="Self-Heal" value={settings.selfHealEnabled} onChange={toggleSelfHeal} desc="Auto-fix plugin errors" />
                  <ToggleSetting label="Auto Fix" value={settings.selfHealAutoFix} onChange={(v) => updateSetting("selfHealAutoFix", v)} desc="Fix without confirmation" />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="glass-panel rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-[#8b949e] uppercase font-bold">{label}</span></div>
      <div className="text-xl font-bold text-white">{value}</div>
      {sub && <div className="text-[10px] text-[#8b949e] mt-1">{sub}</div>}
    </div>
  );
}

function InfoRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-[#21262d]">
      <span className="text-[#8b949e]">{label}</span>
      <span className="font-mono" style={color ? { color } : {}}>{value}</span>
    </div>
  );
}

function RAMBar({ label, used, total, color }: { label: string; used: number; total: number; color: string }) {
  const pct = Math.min(100, Math.round((used / total) * 100));
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-[#8b949e]">{label}</span>
        <span style={{ color }}>{used} / {total} MB ({pct}%)</span>
      </div>
      <div className="h-2 bg-[#21262d] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}40` }} />
      </div>
    </div>
  );
}

function AgentCard({ emoji, name, role, desc, active }: { emoji: string; name: string; role: string; desc: string; active: boolean }) {
  return (
    <div className={`p-3 rounded-lg border transition-all ${active ? "bg-[#00e5ff]/5 border-[#00e5ff]/30" : "bg-[#21262d]/30 border-[#30363d]"}`}>
      <div className="text-lg mb-1">{emoji}</div>
      <div className="text-xs font-bold text-white">{name}</div>
      <div className="text-[10px] text-[#00e5ff]">{role}</div>
      <div className="text-[10px] text-[#8b949e] mt-1">{desc}</div>
      <div className={`w-2 h-2 rounded-full mt-2 ${active ? "bg-[#00e676] shadow-[0_0_6px_#00e676]" : "bg-[#484f58]"}`} />
    </div>
  );
}

function SettingInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [val, setVal] = useState(value);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setVal(value); setDirty(false); }, [value]);
  return (
    <div>
      <label className="text-[10px] uppercase text-[#8b949e] font-bold mb-1 block">{label}</label>
      <div className="flex gap-2">
        <input value={val} onChange={(e) => { setVal(e.target.value); setDirty(true); }} className="flex-1 bg-[#010409] border border-[#30363d] rounded px-3 py-2 text-sm outline-none focus:border-[#00e5ff]" />
        {dirty && <button onClick={() => { onChange(val); setDirty(false); }} className="px-3 py-2 bg-[#00e5ff] text-black rounded text-xs font-bold hover:bg-[#00b8d4]">Save</button>}
      </div>
    </div>
  );
}

function ToggleSetting({ label, value, onChange, desc }: { label: string; value: boolean; onChange: (v: boolean) => void; desc: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-[#010409] border border-[#21262d]">
      <div>
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="text-[10px] text-[#8b949e]">{desc}</div>
      </div>
      <button onClick={() => onChange(!value)} className={`w-10 h-5 rounded-full transition-all relative ${value ? "bg-[#00e676]" : "bg-[#30363d]"}`}>
        <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${value ? "left-5" : "left-0.5"}`} />
      </button>
    </div>
  );
}
