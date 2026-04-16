/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Cpu, HardDrive, Activity, Settings, Shield, Terminal,
  RefreshCw, Power, Wifi, WifiOff, ChevronRight, Send,
  Zap, Users, MessageSquare, Clock, MemoryStick, Server,
  Eye, Wrench, CheckCircle2, AlertTriangle,
  Loader2, ArrowUpCircle, Globe, Hash, Code2, Layers,
  TrendingUp, BarChart3, PieChart, Database, Gauge,
  Sparkles, Flame,
  MonitorSmartphone, ShieldCheck, ShieldAlert,
  GitBranch, FileCode, Package, Timer,
  Minus, Plus, Search, Bell, Menu,
} from "lucide-react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, PieChart as RPieChart, Pie, Cell,
  Legend,
} from "recharts";

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════
interface BotStatus {
  ram: { total: number; free: number; used: number; process: number; heapUsed: number; heapTotal: number; percentage: number; processPercentage: number };
  cpu: { model: string; cores: number; speed: number; usage?: number };
  bot: { name: string; uptime: number; uptimeFormatted: string; pluginCount: number; userCount: number; groupCount: number; version: string; platform: string; ownerName: string; ownerNumber: string; prefix: string; isPublic: boolean; messageCount?: number };
  system: { platform: string; arch: string; hostname: string; nodeVersion: string; uptime: number };
}

interface SelfHealEvent {
  type: string;
  timestamp: number;
  plugin?: string;
  errorType?: string;
  cycle?: number;
  maxCycles?: number;
  success?: boolean;
  message?: string;
  [key: string]: any;
}

interface LogEntry {
  time: string;
  type: "INFO" | "WARN" | "ERR" | "SUCC" | "FIX" | "TEST";
  source: string;
  text: string;
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
  autoRead: boolean;
  welcomeMessage: boolean;
  antiLink: boolean;
  antiToxic: boolean;
}

interface HistoryPoint {
  time: string;
  ram: number;
  cpu: number;
  users: number;
  messages: number;
}

// ═══════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════
const DEFAULT_BOT_URL = process.env.NEXT_PUBLIC_BOT_API_URL || "";
const DEFAULT_API_KEY = process.env.NEXT_PUBLIC_BOT_API_KEY || "selfheal-dashboard";

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
const formatBytes = (bytes: number) => {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
  return (bytes / 1073741824).toFixed(2) + " GB";
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
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

const COLORS = {
  cyan: "#00e5ff",
  purple: "#7c4dff",
  green: "#00e676",
  orange: "#ffab00",
  red: "#ff1744",
  pink: "#e040fb",
  blue: "#448aff",
};

const PIE_COLORS = [COLORS.cyan, COLORS.purple, COLORS.green, COLORS.orange, COLORS.pink];

// ═══════════════════════════════════════════════════════════
// ANIMATION VARIANTS
// ═══════════════════════════════════════════════════════════
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring" as const, stiffness: 100, damping: 15 },
  },
};

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export default function HertaDashboard() {
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState(DEFAULT_API_KEY);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "selfheal" | "settings" | "terminal" | "analytics">("overview");
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [settings, setSettings] = useState<BotSettings | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [events, setEvents] = useState<SelfHealEvent[]>([]);
  const [commandInput, setCommandInput] = useState("");
  const [commandOutput, setCommandOutput] = useState<string[]>(["> Dashboard ready. Auto-connecting..."]);
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [selfHealStatus, setSelfHealStatus] = useState<any>(null);
  const [autoConnectAttempted, setAutoConnectAttempted] = useState(false);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState<Record<string, boolean>>({});
  const [mounted, setMounted] = useState(false);

  const logEndRef = useRef<HTMLDivElement>(null);
  const cmdEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const historyRef = useRef<NodeJS.Timeout | null>(null);

  // Mount animation
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load saved config
  useEffect(() => {
    const savedUrl = typeof window !== "undefined" ? localStorage.getItem("bot_api_url") : null;
    const savedKey = typeof window !== "undefined" ? localStorage.getItem("bot_api_key") : null;
    setApiUrl(savedUrl || DEFAULT_BOT_URL);
    if (savedKey) setApiKey(savedKey);
  }, []);

  // ── API Fetch Helper ──
  const apiFetch = useCallback(
    async (urlPath: string, opts: RequestInit = {}, customUrl?: string) => {
      const baseUrl = customUrl || apiUrl;
      if (!baseUrl) throw new Error("Bot URL not configured");
      // Ensure clean URL construction
      const cleanBase = baseUrl.replace(/\/+$/, "");
      const separator = urlPath.includes("?") ? "&" : "?";
      const url = `${cleanBase}/api/dashboard${urlPath}${separator}key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        ...opts,
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
          ...(opts.headers || {}),
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return res.json();
    },
    [apiUrl, apiKey]
  );

  // ── Track history data for charts ──
  const addHistoryPoint = useCallback((s: BotStatus) => {
    setHistory((prev) => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
      const newPoint: HistoryPoint = {
        time: timeStr,
        ram: Math.round((s.ram.process / 1048576) * 10) / 10,
        cpu: s.cpu.usage || Math.round(s.ram.processPercentage || (s.ram.process / s.ram.total) * 100),
        users: s.bot.userCount || 0,
        messages: s.bot.messageCount || 0,
      };
      const updated = [...prev, newPoint];
      // Keep last 30 points
      return updated.slice(-30);
    });
  }, []);

  // ── Connect to Bot ──
  const connectToBot = useCallback(async (overrideUrl?: string) => {
    const targetUrl = overrideUrl || apiUrl;
    if (!targetUrl) {
      setShowApiConfig(true);
      setLogs((p) => [...p, { time: getTime(), type: "WARN", source: "SYS", text: "Bot URL belum diset. Masukkan URL bot kamu." }]);
      return;
    }
    setConnecting(true);
    try {
      const data = await apiFetch("/stats", {}, targetUrl);
      setStatus(data);
      setConnected(true);
      setShowApiConfig(false);
      addHistoryPoint(data);
      setLogs((p) => [...p, { time: getTime(), type: "SUCC", source: "SYS", text: `Connected to ${data.bot?.name || "Bot"} | ${data.bot?.userCount || 0} users | ${data.bot?.groupCount || 0} groups` }]);

      // Save config
      if (typeof window !== "undefined") {
        localStorage.setItem("bot_api_url", targetUrl);
        localStorage.setItem("bot_api_key", apiKey);
      }

      // Load settings
      try {
        const s = await apiFetch("/settings", {}, targetUrl);
        setSettings(s);
      } catch {
        // Use defaults from status if settings endpoint fails
        if (data.bot) {
          setSettings({
            botName: data.bot.name || "",
            ownerName: data.bot.ownerName || "",
            prefix: data.bot.prefix || ".",
            isPublic: data.bot.isPublic ?? true,
            autoTyping: true,
            antiSpam: true,
            autoSticker: false,
            selfHealEnabled: true,
            selfHealAutoFix: true,
            selfHealTimeout: 30000,
            selfHealMaxCycles: 3,
            autoRead: false,
            welcomeMessage: true,
            antiLink: false,
            antiToxic: false,
          });
        }
      }

      // Load self-heal status
      try {
        const sh = await apiFetch("/selfheal/status", {}, targetUrl);
        setSelfHealStatus(sh);
      } catch {}

      // Load activity logs
      try {
        const logData = await apiFetch("/logs", {}, targetUrl);
        if (Array.isArray(logData)) {
          setLogs((p) => [
            ...p,
            ...logData.slice(-50).map((l: any) => ({
              time: new Date(l.time).toLocaleTimeString("id-ID"),
              type: l.type as LogEntry["type"],
              source: l.source,
              text: l.text,
            })),
          ]);
        }
      } catch {}

      // Load self-heal events
      try {
        const evData = await apiFetch("/selfheal/events", {}, targetUrl);
        if (Array.isArray(evData)) setEvents(evData);
      } catch {}

      // Start SSE for real-time updates
      if (eventSourceRef.current) eventSourceRef.current.close();
      try {
        const cleanBase = targetUrl.replace(/\/+$/, "");
        const es = new EventSource(`${cleanBase}/api/dashboard/events?key=${encodeURIComponent(apiKey)}`);
        es.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg.event === "connected") {
              setLogs((p) => [...p.slice(-99), { time: getTime(), type: "SUCC", source: "SSE", text: "Real-time stream connected" }]);
            } else if (msg.event === "log") {
              const l = msg.data;
              setLogs((p) => [...p.slice(-99), {
                time: new Date(l.time).toLocaleTimeString("id-ID"),
                type: l.type,
                source: l.source,
                text: l.text,
              }]);
            } else if (msg.event === "stats_update" || msg.event === "status") {
              if (msg.data) {
                setStatus(msg.data);
                addHistoryPoint(msg.data);
              }
            } else if (msg.event === "selfheal_event") {
              setEvents((prev) => [...prev.slice(-49), msg.data]);
            } else if (msg.event === "setting_change") {
              setSettings((prev) => prev ? { ...prev, [msg.data.key]: msg.data.value } : prev);
              setLogs((p) => [...p.slice(-99), { time: getTime(), type: "INFO", source: "SSE", text: `Setting: ${msg.data.key} = ${msg.data.value}` }]);
            } else if (msg.event === "restart") {
              setLogs((p) => [...p.slice(-99), { time: getTime(), type: "WARN", source: "SSE", text: "Bot restarting..." }]);
              setConnected(false);
            }
          } catch {}
        };
        es.onerror = () => {
          setLogs((p) => [...p.slice(-99), { time: getTime(), type: "WARN", source: "SSE", text: "Stream interrupted, polling active" }]);
        };
        eventSourceRef.current = es;
      } catch {}

      // Start polling for real-time stats
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const d = await apiFetch("/stats", {}, targetUrl);
          setStatus(d);
          addHistoryPoint(d);
        } catch {
          setConnected(false);
        }
      }, 8000);
    } catch (err: any) {
      setLogs((p) => [...p, { time: getTime(), type: "ERR", source: "SYS", text: `Connection failed: ${err.message}` }]);
      setConnected(false);
      setShowApiConfig(true);
    } finally {
      setConnecting(false);
    }
  }, [apiUrl, apiKey, apiFetch, addHistoryPoint]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnectAttempted) return;
    setAutoConnectAttempted(true);
    const timer = setTimeout(() => {
      const savedUrl = typeof window !== "undefined" ? localStorage.getItem("bot_api_url") : null;
      const targetUrl = savedUrl || DEFAULT_BOT_URL;
      if (targetUrl) {
        setApiUrl(targetUrl);
        setLogs((p) => [...p, { time: getTime(), type: "INFO", source: "SYS", text: `Auto-connecting to ${targetUrl}...` }]);
        connectToBot(targetUrl);
      } else {
        setShowApiConfig(true);
        setLogs((p) => [...p, { time: getTime(), type: "WARN", source: "SYS", text: "Masukkan URL bot kamu untuk memulai." }]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [autoConnectAttempted, connectToBot]);

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
      setCommandOutput((p) => [...p, `  ${data.success ? "✓" : "✗"} ${data.message || "Done"}`]);
      if (data.planId) setCommandOutput((p) => [...p, `  Plan: ${data.planId}`]);
    } catch (err: any) {
      setCommandOutput((p) => [...p, `  ✗ Error: ${err.message}`]);
    }
  };

  // ── Toggle Self-Heal ──
  const toggleSelfHeal = async () => {
    try {
      const data = await apiFetch("/selfheal/toggle", { method: "POST" });
      setSettings((p) => (p ? { ...p, selfHealEnabled: data.enabled } : p));
      setSelfHealStatus((prev: any) => prev ? { ...prev, enabled: data.enabled } : prev);
      setLogs((p) => [...p, { time: getTime(), type: "SUCC", source: "Dashboard", text: `Self-Heal ${data.enabled ? "enabled" : "disabled"}` }]);
    } catch (err: any) {
      setLogs((p) => [...p, { time: getTime(), type: "ERR", source: "Dashboard", text: `Toggle failed: ${err.message}` }]);
    }
  };

  // ── Update Setting (with loading state) ──
  const updateSetting = async (key: string, value: any) => {
    setSettingsSaving((prev) => ({ ...prev, [key]: true }));
    try {
      await apiFetch("/settings", { method: "POST", body: JSON.stringify({ [key]: value }) });
      setSettings((p) => (p ? { ...p, [key]: value } : p));
      setLogs((p) => [...p, { time: getTime(), type: "SUCC", source: "Settings", text: `Updated ${key} = ${JSON.stringify(value)}` }]);
    } catch (err: any) {
      setLogs((p) => [...p, { time: getTime(), type: "ERR", source: "Settings", text: `Failed to update ${key}: ${err.message}` }]);
    } finally {
      setSettingsSaving((prev) => ({ ...prev, [key]: false }));
    }
  };

  // ── Trigger Manual Self-Heal ──
  const triggerManualHeal = async (pluginName: string) => {
    try {
      const data = await apiFetch("/selfheal/fix", {
        method: "POST",
        body: JSON.stringify({ plugin: pluginName, description: `Manual fix for ${pluginName}` }),
      });
      setLogs((p) => [...p, { time: getTime(), type: "FIX", source: "Self-Heal", text: `Manual fix triggered for ${pluginName}: ${data.message || "Started"}` }]);
    } catch (err: any) {
      setLogs((p) => [...p, { time: getTime(), type: "ERR", source: "Self-Heal", text: `Fix trigger failed: ${err.message}` }]);
    }
  };

  // ── Restart Bot ──
  const restartBot = async () => {
    if (!confirm("Restart bot? This will disconnect all sessions.")) return;
    try {
      await apiFetch("/restart", { method: "POST" });
      setLogs((p) => [...p, { time: getTime(), type: "WARN", source: "Dashboard", text: "Bot restarting..." }]);
      setConnected(false);
    } catch {}
  };

  // ── Save Config ──
  const saveConfig = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("bot_api_url", apiUrl);
      localStorage.setItem("bot_api_key", apiKey);
    }
    connectToBot(apiUrl);
  };

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    cmdEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [commandOutput]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      if (pollRef.current) clearInterval(pollRef.current);
      if (historyRef.current) clearInterval(historyRef.current);
    };
  }, []);

  // ── Computed data for charts ──
  const ramPercentage = status ? Math.round((status.ram.process / status.ram.total) * 100) : 0;
  const heapPercentage = status ? Math.round((status.ram.heapUsed / status.ram.heapTotal) * 100) : 0;

  const pieData = useMemo(() => {
    if (!status) return [];
    return [
      { name: "Heap Used", value: Math.round(status.ram.heapUsed / 1048576) },
      { name: "Heap Free", value: Math.round((status.ram.heapTotal - status.ram.heapUsed) / 1048576) },
      { name: "Process RSS", value: Math.round((status.ram.process - status.ram.heapTotal) / 1048576) },
    ].filter((d) => d.value > 0);
  }, [status]);

  const selfHealStats = useMemo(() => {
    const total = events.length;
    const successes = events.filter((e) => e.type === "fix_success" || e.success).length;
    const failures = events.filter((e) => e.type === "fix_failed" || (e.type === "fix_complete" && !e.success)).length;
    const pending = events.filter((e) => e.type === "fix_started").length;
    return { total, successes, failures, pending, rate: total > 0 ? Math.round((successes / total) * 100) : 0 };
  }, [events]);

  // ═══════════════════════════════════════════════════════════
  // TABS
  // ═══════════════════════════════════════════════════════════
  const tabs = [
    { id: "overview" as const, icon: Activity, label: "Overview", color: COLORS.cyan },
    { id: "analytics" as const, icon: BarChart3, label: "Analytics", color: COLORS.purple },
    { id: "selfheal" as const, icon: Shield, label: "Self-Heal AI", color: COLORS.green },
    { id: "terminal" as const, icon: Terminal, label: "Command", color: COLORS.orange },
    { id: "settings" as const, icon: Settings, label: "Settings", color: COLORS.pink },
  ];

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className={`min-h-screen h-screen bg-[#06070a] text-[#e6edf3] flex flex-col overflow-hidden transition-opacity duration-500 ${mounted ? "opacity-100" : "opacity-0"}`}>
      {/* ── TOP BAR ── */}
      <motion.header
        initial={{ y: -60 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
        className="h-14 border-b border-[#30363d] bg-[#0d1117]/95 backdrop-blur-xl flex items-center px-4 gap-3 shrink-0 z-50 relative"
      >
        {/* Mobile menu toggle */}
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden p-1.5 rounded-lg hover:bg-[#21262d] transition-colors">
          <Menu className="w-5 h-5 text-[#8b949e]" />
        </button>

        {/* Logo & Status */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className={`w-3 h-3 rounded-full status-dot ${connected ? "bg-[#00e676] online" : connecting ? "bg-[#ffab00] animate-pulse" : "bg-[#ff1744] offline"}`} />
          </div>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00e5ff] to-[#7c4dff] flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div className="hidden sm:block">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white">{status?.bot?.name || "Herta V3"}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00e5ff]/10 text-[#00e5ff] border border-[#00e5ff]/20 font-mono">
                v{status?.bot?.version || "3.0"}
              </span>
            </div>
            <p className="text-[10px] text-[#8b949e] -mt-0.5">
              {connected ? "Connected" : connecting ? "Connecting..." : "Disconnected"}
            </p>
          </div>
        </div>

        <div className="flex-1" />

        {/* Live Stats in Header */}
        {connected && status && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="hidden lg:flex items-center gap-5 text-xs text-[#8b949e]"
          >
            <div className="flex items-center gap-1.5" title="Uptime">
              <Clock className="w-3.5 h-3.5 text-[#00e5ff]" />
              <span>{status.bot.uptimeFormatted || formatUptime(status.bot.uptime)}</span>
            </div>
            <div className="flex items-center gap-1.5" title="RAM">
              <MemoryStick className="w-3.5 h-3.5 text-[#ffab00]" />
              <span>{formatBytes(status.ram.process)}</span>
              <span className="text-[#484f58]">({ramPercentage}%)</span>
            </div>
            <div className="flex items-center gap-1.5" title="Users">
              <Users className="w-3.5 h-3.5 text-[#e040fb]" />
              <span className="text-white font-medium">{(status.bot.userCount || 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5" title="Groups">
              <MessageSquare className="w-3.5 h-3.5 text-[#00e676]" />
              <span>{status.bot.groupCount || 0}</span>
            </div>
            <div className="flex items-center gap-1.5" title="Plugins">
              <Layers className="w-3.5 h-3.5 text-[#7c4dff]" />
              <span>{status.bot.pluginCount} plugins</span>
            </div>
          </motion.div>
        )}

        {connecting && (
          <div className="flex items-center gap-2 text-xs text-[#ffab00]">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Connecting...</span>
          </div>
        )}

        {/* Config button */}
        <button
          onClick={() => setShowApiConfig(!showApiConfig)}
          className="p-2 rounded-lg hover:bg-[#21262d] transition-all group"
          title="Bot URL Settings"
        >
          <Settings className="w-4 h-4 text-[#8b949e] group-hover:text-white group-hover:rotate-90 transition-all duration-300" />
        </button>
      </motion.header>

      {/* ── API CONFIG PANEL ── */}
      <AnimatePresence>
        {showApiConfig && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="border-b border-[#30363d] bg-[#010409] overflow-hidden z-40"
          >
            <div className="p-4">
              <div className="max-w-2xl mx-auto">
                <div className="text-xs text-[#8b949e] mb-3 flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5" />
                  Masukkan URL bot kamu. Dashboard akan otomatis connect setelah disimpan.
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label className="text-[10px] uppercase text-[#8b949e] font-bold mb-1 block">Bot URL</label>
                    <input
                      value={apiUrl}
                      onChange={(e) => setApiUrl(e.target.value)}
                      placeholder="https://your-bot-url.herokuapp.com"
                      className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#00e5ff] focus:ring-1 focus:ring-[#00e5ff]/20 transition-all"
                    />
                  </div>
                  <div className="w-full sm:w-48">
                    <label className="text-[10px] uppercase text-[#8b949e] font-bold mb-1 block">API Key</label>
                    <input
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      type="password"
                      className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#00e5ff] focus:ring-1 focus:ring-[#00e5ff]/20 transition-all"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={saveConfig}
                      disabled={connecting || !apiUrl}
                      className="px-6 py-2.5 rounded-lg font-bold text-sm bg-gradient-to-r from-[#00e5ff] to-[#7c4dff] text-white hover:shadow-lg hover:shadow-[#00e5ff]/20 disabled:opacity-50 transition-all flex items-center gap-2"
                    >
                      {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                      {connecting ? "Connecting..." : "Connect"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MAIN LAYOUT ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── SIDEBAR ── */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.nav
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: "auto", opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-14 md:w-52 bg-[#0d1117]/90 backdrop-blur-xl border-r border-[#30363d] flex flex-col py-3 shrink-0 overflow-hidden"
            >
              <div className="px-3 mb-3 hidden md:block">
                <p className="text-[10px] uppercase text-[#484f58] font-bold tracking-wider">Navigation</p>
              </div>
              <div className="space-y-0.5 px-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-all duration-200 ${
                      activeTab === tab.id
                        ? "text-white bg-gradient-to-r from-[#00e5ff]/15 to-transparent border-l-2"
                        : "text-[#8b949e] hover:text-white hover:bg-[#21262d]/60"
                    }`}
                    style={activeTab === tab.id ? { borderLeftColor: tab.color } : {}}
                  >
                    <tab.icon
                      className="w-4 h-4 shrink-0 transition-colors"
                      style={activeTab === tab.id ? { color: tab.color } : {}}
                    />
                    <span className="hidden md:block truncate">{tab.label}</span>
                    {activeTab === tab.id && (
                      <div className="hidden md:block ml-auto w-1.5 h-1.5 rounded-full" style={{ background: tab.color, boxShadow: `0 0 6px ${tab.color}` }} />
                    )}
                  </button>
                ))}
              </div>

              <div className="flex-1" />

              {/* Bottom actions */}
              {connected && (
                <div className="px-2 space-y-1 mt-2">
                  <button
                    onClick={() => connectToBot()}
                    className="w-full flex items-center gap-3 px-3 py-2 text-xs text-[#8b949e] hover:text-[#00e5ff] hover:bg-[#21262d]/60 rounded-lg transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden md:block">Refresh</span>
                  </button>
                  <button
                    onClick={restartBot}
                    className="w-full flex items-center gap-3 px-3 py-2 text-xs text-[#ff6b6b] hover:bg-[#ff1744]/10 rounded-lg transition-all"
                  >
                    <Power className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden md:block">Restart Bot</span>
                  </button>
                </div>
              )}
            </motion.nav>
          )}
        </AnimatePresence>

        {/* ── CONTENT AREA ── */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 dot-pattern">
          {/* Not connected */}
          {!connected && !connecting && !showApiConfig && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center justify-center h-full text-[#8b949e]"
            >
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#ff1744]/20 to-[#ff1744]/5 flex items-center justify-center mb-6 border border-[#ff1744]/20">
                <WifiOff className="w-10 h-10 text-[#ff1744]" />
              </div>
              <p className="text-xl font-bold text-white mb-1">Disconnected</p>
              <p className="text-sm mb-6 text-center max-w-sm">Bot sedang offline atau URL belum dikonfigurasi</p>
              <div className="flex gap-3">
                <button
                  onClick={() => connectToBot()}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#00e5ff] to-[#7c4dff] text-white rounded-lg text-sm font-bold hover:shadow-lg hover:shadow-[#00e5ff]/20 transition-all flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" /> Reconnect
                </button>
                <button
                  onClick={() => setShowApiConfig(true)}
                  className="px-5 py-2.5 bg-[#21262d] rounded-lg text-sm hover:bg-[#30363d] transition-all"
                >
                  Configure URL
                </button>
              </div>
            </motion.div>
          )}

          {/* Connecting */}
          {connecting && !connected && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-full"
            >
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#00e5ff]/20 to-[#7c4dff]/20 flex items-center justify-center border border-[#00e5ff]/20 animate-pulse-glow">
                  <Loader2 className="w-10 h-10 text-[#00e5ff] animate-spin" />
                </div>
              </div>
              <p className="text-lg font-bold text-white mb-1">Connecting...</p>
              <p className="text-sm text-[#8b949e] text-center max-w-sm font-mono">{apiUrl}</p>
            </motion.div>
          )}

          {/* ═══ OVERVIEW TAB ═══ */}
          {activeTab === "overview" && connected && status && (
            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-5">
              {/* Stats Cards Row */}
              <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  icon={<Clock className="w-5 h-5" />}
                  label="Uptime"
                  value={status.bot.uptimeFormatted || formatUptime(status.bot.uptime)}
                  color={COLORS.cyan}
                  trend="stable"
                />
                <StatCard
                  icon={<MemoryStick className="w-5 h-5" />}
                  label="RAM Usage"
                  value={formatBytes(status.ram.process)}
                  sub={`${ramPercentage}% of ${formatBytes(status.ram.total)}`}
                  color={COLORS.orange}
                  trend={ramPercentage > 80 ? "danger" : ramPercentage > 60 ? "warning" : "good"}
                />
                <StatCard
                  icon={<Users className="w-5 h-5" />}
                  label="Total Users"
                  value={(status.bot.userCount || 0).toLocaleString()}
                  sub={`${(status.bot.groupCount || 0).toLocaleString()} groups`}
                  color={COLORS.pink}
                  trend="good"
                />
                <StatCard
                  icon={<Layers className="w-5 h-5" />}
                  label="Plugins"
                  value={String(status.bot.pluginCount || 0)}
                  sub={`${status.bot.prefix} prefix`}
                  color={COLORS.green}
                  trend="stable"
                />
              </motion.div>

              {/* Charts Row */}
              <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* RAM History Chart */}
                <div className="glass-panel rounded-xl p-5 lg:col-span-2">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#00e5ff]" />
                    Memory Usage History
                    <span className="text-[10px] text-[#8b949e] font-normal ml-auto">Real-time</span>
                  </h3>
                  <div className="h-[200px]">
                    {history.length > 1 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={history}>
                          <defs>
                            <linearGradient id="ramGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#00e5ff" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#00e5ff" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#7c4dff" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#7c4dff" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                          <XAxis dataKey="time" tick={{ fill: "#8b949e", fontSize: 10 }} axisLine={{ stroke: "#21262d" }} />
                          <YAxis tick={{ fill: "#8b949e", fontSize: 10 }} axisLine={{ stroke: "#21262d" }} unit=" MB" />
                          <RTooltip
                            contentStyle={{ background: "#161b22", border: "1px solid #30363d", borderRadius: "8px", fontSize: "12px" }}
                            labelStyle={{ color: "#8b949e" }}
                          />
                          <Area type="monotone" dataKey="ram" name="RAM (MB)" stroke="#00e5ff" fill="url(#ramGradient)" strokeWidth={2} dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-[#484f58] text-sm">
                        <div className="text-center">
                          <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p>Collecting data...</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Memory Pie Chart */}
                <div className="glass-panel rounded-xl p-5">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-[#7c4dff]" />
                    Memory Breakdown
                  </h3>
                  <div className="h-[200px]">
                    {pieData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <RPieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={70}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {pieData.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <RTooltip
                            contentStyle={{ background: "#161b22", border: "1px solid #30363d", borderRadius: "8px", fontSize: "12px" }}
                            formatter={(value: any) => [`${value} MB`, ""]}
                          />
                          <Legend
                            wrapperStyle={{ fontSize: "10px" }}
                            formatter={(value: string) => <span className="text-[#8b949e]">{value}</span>}
                          />
                        </RPieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-[#484f58] text-sm">No data</div>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Bot Info + System */}
              <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Bot Info */}
                <div className="glass-panel rounded-xl p-5 neon-border-cyan">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <Bot className="w-4 h-4 text-[#00e5ff]" /> Bot Information
                  </h3>
                  <div className="space-y-2.5 stagger-children">
                    <InfoRow icon={<Hash className="w-3.5 h-3.5" />} label="Name" value={status.bot.name} />
                    <InfoRow icon={<Users className="w-3.5 h-3.5" />} label="Owner" value={status.bot.ownerName} />
                    <InfoRow icon={<Globe className="w-3.5 h-3.5" />} label="Number" value={status.bot.ownerNumber || "N/A"} />
                    <InfoRow icon={<Code2 className="w-3.5 h-3.5" />} label="Prefix" value={status.bot.prefix} />
                    <InfoRow
                      icon={<Eye className="w-3.5 h-3.5" />}
                      label="Mode"
                      value={status.bot.isPublic ? "Public" : "Self"}
                      badge={status.bot.isPublic ? "green" : "orange"}
                    />
                    <InfoRow icon={<MonitorSmartphone className="w-3.5 h-3.5" />} label="Platform" value={status.bot.platform} />
                    <InfoRow icon={<GitBranch className="w-3.5 h-3.5" />} label="Version" value={`v${status.bot.version}`} />
                    <InfoRow icon={<Server className="w-3.5 h-3.5" />} label="Node.js" value={status.system.nodeVersion} />
                    <InfoRow icon={<Cpu className="w-3.5 h-3.5" />} label="CPU" value={`${status.cpu.cores} cores @ ${status.cpu.speed}MHz`} />
                    <InfoRow icon={<HardDrive className="w-3.5 h-3.5" />} label="System" value={`${status.system.platform} ${status.system.arch}`} />
                  </div>
                </div>

                {/* Resource Bars */}
                <div className="glass-panel rounded-xl p-5 neon-border-purple">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-[#7c4dff]" /> Resource Monitor
                  </h3>
                  <div className="space-y-5">
                    <ResourceBar
                      label="Process RSS"
                      used={Math.round(status.ram.process / 1048576)}
                      total={Math.round(status.ram.total / 1048576)}
                      color={COLORS.cyan}
                      icon={<MemoryStick className="w-3.5 h-3.5" />}
                    />
                    <ResourceBar
                      label="Heap Used"
                      used={Math.round(status.ram.heapUsed / 1048576)}
                      total={Math.round(status.ram.heapTotal / 1048576)}
                      color={COLORS.green}
                      icon={<Database className="w-3.5 h-3.5" />}
                    />
                    <ResourceBar
                      label="System RAM"
                      used={Math.round(status.ram.used / 1048576)}
                      total={Math.round(status.ram.total / 1048576)}
                      color={COLORS.orange}
                      icon={<Server className="w-3.5 h-3.5" />}
                    />
                    <ResourceBar
                      label="Heap Allocation"
                      used={Math.round(status.ram.heapTotal / 1048576)}
                      total={Math.round(status.ram.total / 1048576)}
                      color={COLORS.purple}
                      icon={<HardDrive className="w-3.5 h-3.5" />}
                    />
                  </div>

                  {/* Quick Status Footer */}
                  <div className="mt-5 pt-4 border-t border-[#21262d] grid grid-cols-2 gap-3">
                    <StatusBadge
                      label="Self-Heal"
                      active={selfHealStatus?.enabled ?? settings?.selfHealEnabled ?? false}
                    />
                    <StatusBadge
                      label="Auto Fix"
                      active={selfHealStatus?.autoFix ?? settings?.selfHealAutoFix ?? false}
                    />
                    <StatusBadge
                      label="Public Mode"
                      active={status.bot.isPublic}
                    />
                    <StatusBadge
                      label="Connected"
                      active={connected}
                    />
                  </div>
                </div>
              </motion.div>

              {/* Activity Log */}
              <motion.div variants={itemVariants} className="glass-panel rounded-xl p-5">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#00e5ff]" />
                  Activity Log
                  <span className="ml-auto text-[10px] text-[#484f58]">{logs.length} entries</span>
                </h3>
                <div className="max-h-[220px] overflow-y-auto font-mono text-xs space-y-0.5 rounded-lg bg-[#010409]/60 p-3 border border-[#21262d]">
                  {logs.slice(-40).map((l, i) => (
                    <div key={i} className="flex gap-2 py-1 border-b border-[#21262d]/40 hover:bg-[#21262d]/20 px-1 rounded transition-colors">
                      <span className="text-[#484f58] shrink-0 w-16">{l.time}</span>
                      <span className={`shrink-0 w-6 text-center font-bold ${
                        l.type === "SUCC" ? "text-[#00e676]" :
                        l.type === "ERR" ? "text-[#ff1744]" :
                        l.type === "WARN" ? "text-[#ffab00]" :
                        l.type === "FIX" ? "text-[#e040fb]" :
                        l.type === "TEST" ? "text-[#7c4dff]" :
                        "text-[#00e5ff]"
                      }`}>
                        {l.type === "SUCC" ? "✓" : l.type === "ERR" ? "✗" : l.type === "WARN" ? "!" : l.type === "FIX" ? "⚡" : "●"}
                      </span>
                      <span className="text-[#00e5ff] shrink-0 w-16 truncate">{l.source}</span>
                      <span className="text-[#c9d1d9] truncate">{l.text}</span>
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* ═══ ANALYTICS TAB ═══ */}
          {activeTab === "analytics" && connected && status && (
            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-5">
              {/* Top Stats */}
              <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MiniStat label="Total Users" value={(status.bot.userCount || 0).toLocaleString()} icon={<Users className="w-4 h-4" />} color={COLORS.cyan} />
                <MiniStat label="Total Groups" value={(status.bot.groupCount || 0).toLocaleString()} icon={<MessageSquare className="w-4 h-4" />} color={COLORS.green} />
                <MiniStat label="Plugins Active" value={String(status.bot.pluginCount || 0)} icon={<Package className="w-4 h-4" />} color={COLORS.purple} />
                <MiniStat label="Self-Heal Rate" value={`${selfHealStats.rate}%`} icon={<ShieldCheck className="w-4 h-4" />} color={selfHealStats.rate > 70 ? COLORS.green : COLORS.orange} />
              </motion.div>

              {/* Big Charts */}
              <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* RAM Over Time */}
                <div className="glass-panel rounded-xl p-5">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#00e5ff]" /> RAM Trend
                  </h3>
                  <div className="h-[250px]">
                    {history.length > 1 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={history}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                          <XAxis dataKey="time" tick={{ fill: "#8b949e", fontSize: 10 }} />
                          <YAxis tick={{ fill: "#8b949e", fontSize: 10 }} unit=" MB" />
                          <RTooltip contentStyle={{ background: "#161b22", border: "1px solid #30363d", borderRadius: "8px", fontSize: "12px" }} />
                          <Line type="monotone" dataKey="ram" name="RAM (MB)" stroke="#00e5ff" strokeWidth={2} dot={{ fill: "#00e5ff", r: 3 }} activeDot={{ r: 5 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-[#484f58] text-sm">Collecting data...</div>
                    )}
                  </div>
                </div>

                {/* User Distribution */}
                <div className="glass-panel rounded-xl p-5">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-[#e040fb]" /> User & Group Distribution
                  </h3>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RPieChart>
                        <Pie
                          data={[
                            { name: "Users", value: status.bot.userCount || 0 },
                            { name: "Groups", value: status.bot.groupCount || 0 },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          <Cell fill={COLORS.pink} />
                          <Cell fill={COLORS.cyan} />
                        </Pie>
                        <RTooltip contentStyle={{ background: "#161b22", border: "1px solid #30363d", borderRadius: "8px", fontSize: "12px" }} />
                        <Legend wrapperStyle={{ fontSize: "11px" }} formatter={(v) => <span className="text-[#8b949e]">{v}</span>} />
                      </RPieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </motion.div>

              {/* Self-Heal Analytics */}
              <motion.div variants={itemVariants} className="glass-panel rounded-xl p-5">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#00e676]" /> Self-Heal Statistics
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="text-center p-4 rounded-lg bg-[#010409] border border-[#21262d]">
                    <div className="text-3xl font-bold text-white">{selfHealStats.total}</div>
                    <div className="text-xs text-[#8b949e] mt-1">Total Events</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-[#010409] border border-[#21262d]">
                    <div className="text-3xl font-bold text-[#00e676]">{selfHealStats.successes}</div>
                    <div className="text-xs text-[#8b949e] mt-1">Successful Fixes</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-[#010409] border border-[#21262d]">
                    <div className="text-3xl font-bold text-[#ff1744]">{selfHealStats.failures}</div>
                    <div className="text-xs text-[#8b949e] mt-1">Failed Fixes</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-[#010409] border border-[#21262d]">
                    <div className="text-3xl font-bold gradient-text">{selfHealStats.rate}%</div>
                    <div className="text-xs text-[#8b949e] mt-1">Success Rate</div>
                  </div>
                </div>
                {/* Bar chart of events */}
                <div className="h-[180px] mt-4">
                  {events.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        { name: "Success", count: selfHealStats.successes, fill: COLORS.green },
                        { name: "Failed", count: selfHealStats.failures, fill: COLORS.red },
                        { name: "Pending", count: selfHealStats.pending, fill: COLORS.orange },
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                        <XAxis dataKey="name" tick={{ fill: "#8b949e", fontSize: 11 }} />
                        <YAxis tick={{ fill: "#8b949e", fontSize: 11 }} />
                        <RTooltip contentStyle={{ background: "#161b22", border: "1px solid #30363d", borderRadius: "8px" }} />
                        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                          <Cell fill={COLORS.green} />
                          <Cell fill={COLORS.red} />
                          <Cell fill={COLORS.orange} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-[#484f58] text-sm">No self-heal events recorded yet</div>
                  )}
                </div>
              </motion.div>

              {/* System Info Grid */}
              <motion.div variants={itemVariants} className="glass-panel rounded-xl p-5">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <Server className="w-4 h-4 text-[#ffab00]" /> System Information
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <SystemInfoCard label="Platform" value={status.system.platform} icon={<MonitorSmartphone className="w-4 h-4" />} />
                  <SystemInfoCard label="Architecture" value={status.system.arch} icon={<Cpu className="w-4 h-4" />} />
                  <SystemInfoCard label="Hostname" value={status.system.hostname} icon={<Server className="w-4 h-4" />} />
                  <SystemInfoCard label="Node.js" value={status.system.nodeVersion} icon={<Code2 className="w-4 h-4" />} />
                  <SystemInfoCard label="CPU Model" value={status.cpu.model?.split(" ").slice(0, 3).join(" ") || "N/A"} icon={<Cpu className="w-4 h-4" />} />
                  <SystemInfoCard label="CPU Cores" value={`${status.cpu.cores} cores`} icon={<Gauge className="w-4 h-4" />} />
                  <SystemInfoCard label="System Uptime" value={formatUptime(status.system.uptime * 1000)} icon={<Timer className="w-4 h-4" />} />
                  <SystemInfoCard label="Bot Version" value={`v${status.bot.version}`} icon={<GitBranch className="w-4 h-4" />} />
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* ═══ SELF-HEAL TAB ═══ */}
          {activeTab === "selfheal" && connected && (
            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-5">
              {/* Self-Heal Header */}
              <motion.div variants={itemVariants} className="glass-panel rounded-xl p-5 neon-border-green">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00e676]/20 to-[#00e5ff]/20 flex items-center justify-center border border-[#00e676]/20">
                      <Shield className="w-6 h-6 text-[#00e676]" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Self-Heal AI Agent V4</h3>
                      <p className="text-xs text-[#8b949e]">Autonomous error detection, analysis, fix generation & validation</p>
                    </div>
                  </div>
                  <button
                    onClick={toggleSelfHeal}
                    className={`px-5 py-2 rounded-full text-sm font-bold transition-all duration-300 ${
                      settings?.selfHealEnabled
                        ? "bg-[#00e676]/20 text-[#00e676] border border-[#00e676]/40 hover:bg-[#00e676]/30 shadow-[0_0_12px_rgba(0,230,118,0.15)]"
                        : "bg-[#ff1744]/20 text-[#ff1744] border border-[#ff1744]/40 hover:bg-[#ff1744]/30"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {settings?.selfHealEnabled ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                      {settings?.selfHealEnabled ? "Active" : "Disabled"}
                    </span>
                  </button>
                </div>

                {/* AI Agent Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <AgentCard
                    emoji="🔍"
                    name="Mistral AI"
                    role="Analyst"
                    desc="Deep error diagnosis & root cause analysis"
                    active={!!selfHealStatus?.aiAgents?.analyst?.status?.includes("OK")}
                    color={COLORS.cyan}
                    stats={selfHealStatus?.aiAgents?.analyst}
                  />
                  <AgentCard
                    emoji="🔧"
                    name="Cohere AI"
                    role="Fixer"
                    desc="Intelligent code generation & patching"
                    active={!!selfHealStatus?.aiAgents?.fixer?.status?.includes("OK")}
                    color={COLORS.orange}
                    stats={selfHealStatus?.aiAgents?.fixer}
                  />
                  <AgentCard
                    emoji="🧪"
                    name="OpenRouter"
                    role="Tester"
                    desc="Code validation & safety testing"
                    active={!!selfHealStatus?.aiAgents?.tester?.status?.includes("OK")}
                    color={COLORS.green}
                    stats={selfHealStatus?.aiAgents?.tester}
                  />
                </div>
              </motion.div>

              {/* Pipeline Visualization */}
              <motion.div variants={itemVariants} className="glass-panel rounded-xl p-5">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <ArrowUpCircle className="w-4 h-4 text-[#00e5ff]" /> Fix Pipeline
                </h3>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <PipelineStep label="Error Detected" icon={<AlertTriangle className="w-3.5 h-3.5" />} color={COLORS.red} />
                  <ChevronRight className="w-4 h-4 text-[#484f58]" />
                  <PipelineStep label="Analyst" icon={<Search className="w-3.5 h-3.5" />} color={COLORS.cyan} />
                  <ChevronRight className="w-4 h-4 text-[#484f58]" />
                  <PipelineStep label="Fixer" icon={<Wrench className="w-3.5 h-3.5" />} color={COLORS.orange} />
                  <ChevronRight className="w-4 h-4 text-[#484f58]" />
                  <PipelineStep label="Tester" icon={<CheckCircle2 className="w-3.5 h-3.5" />} color={COLORS.green} />
                  <ChevronRight className="w-4 h-4 text-[#484f58]" />
                  <PipelineStep label="Auto-Save" icon={<FileCode className="w-3.5 h-3.5" />} color={COLORS.purple} />
                </div>
                <div className="mt-4 pt-3 border-t border-[#21262d] grid grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-[#8b949e]">Active Sessions: </span>
                    <span className="text-white font-bold">{selfHealStatus?.activeSessions || 0}</span>
                  </div>
                  <div>
                    <span className="text-[#8b949e]">Max Cycles: </span>
                    <span className="text-white font-bold">{selfHealStatus?.maxCycles || settings?.selfHealMaxCycles || 3}</span>
                  </div>
                  <div>
                    <span className="text-[#8b949e]">Timeout: </span>
                    <span className="text-white font-bold">{((selfHealStatus?.timeout || settings?.selfHealTimeout || 30000) / 1000)}s</span>
                  </div>
                </div>
              </motion.div>

              {/* Self-Heal Events */}
              <motion.div variants={itemVariants} className="glass-panel rounded-xl p-5">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#ffab00]" /> Recent Events
                  <span className="ml-auto text-[10px] bg-[#21262d] px-2 py-0.5 rounded-full text-[#8b949e]">{events.length} total</span>
                </h3>
                <div className="max-h-[350px] overflow-y-auto space-y-2">
                  {events.length === 0 ? (
                    <div className="text-center py-8 text-[#484f58]">
                      <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No events yet</p>
                      <p className="text-xs">Errors will appear here when detected</p>
                    </div>
                  ) : (
                    events.slice(-25).reverse().map((ev, i) => (
                      <motion.div
                        key={i}
                        initial={{ x: -10, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-start gap-3 p-3 rounded-lg bg-[#010409] border border-[#21262d] hover:border-[#30363d] transition-all"
                      >
                        <div className={`w-2.5 h-2.5 mt-1 rounded-full shrink-0 ${
                          ev.type === "fix_success" || ev.success ? "bg-[#00e676] shadow-[0_0_6px_#00e676]" :
                          ev.type === "fix_failed" ? "bg-[#ff1744] shadow-[0_0_6px_#ff1744]" :
                          ev.type === "fix_started" ? "bg-[#00e5ff] animate-pulse shadow-[0_0_6px_#00e5ff]" :
                          ev.type === "error_detected" ? "bg-[#ffab00]" :
                          "bg-[#8b949e]"
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-bold text-white">{ev.type?.replace(/_/g, " ").toUpperCase()}</span>
                            {ev.plugin && <span className="text-[#7c4dff] font-mono truncate">{ev.plugin}</span>}
                            {ev.cycle && <span className="text-[#484f58]">Cycle {ev.cycle}/{ev.maxCycles || 3}</span>}
                          </div>
                          {ev.message && <p className="text-[11px] text-[#8b949e] mt-0.5 truncate">{ev.message}</p>}
                          {ev.errorType && <p className="text-[11px] text-[#ff1744] mt-0.5">{ev.errorType}</p>}
                          <div className="text-[10px] text-[#484f58] mt-1">{new Date(ev.timestamp).toLocaleString("id-ID")}</div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* ═══ TERMINAL TAB ═══ */}
          {activeTab === "terminal" && connected && (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="h-full flex flex-col space-y-4"
            >
              <motion.div variants={itemVariants} className="glass-panel rounded-xl p-5 flex-1 flex flex-col neon-border-cyan">
                <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-[#00e676]" /> Command Terminal
                </h3>
                <p className="text-xs text-[#8b949e] mb-3">
                  Send commands to the bot. Example: <code className="text-[#00e5ff] bg-[#00e5ff]/10 px-1.5 py-0.5 rounded">perbaiki fitur twitter</code>
                </p>
                <div className="flex-1 bg-[#010409] border border-[#21262d] rounded-lg p-4 font-mono text-xs overflow-y-auto min-h-[300px]">
                  {commandOutput.map((line, i) => (
                    <div
                      key={i}
                      className={`mb-1 ${
                        line.startsWith(">") ? "text-[#00e5ff]" :
                        line.includes("✓") || line.includes("OK") ? "text-[#00e676]" :
                        line.includes("✗") || line.includes("Error") || line.includes("FAIL") ? "text-[#ff1744]" :
                        "text-[#8b949e]"
                      }`}
                    >
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
                    placeholder="Type a command or describe what to fix..."
                    className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#00e5ff] focus:ring-1 focus:ring-[#00e5ff]/20 font-mono transition-all"
                  />
                  <button
                    onClick={sendCommand}
                    disabled={!commandInput.trim()}
                    className="px-5 py-2.5 bg-gradient-to-r from-[#00e5ff] to-[#7c4dff] text-white rounded-lg font-bold text-sm hover:shadow-lg hover:shadow-[#00e5ff]/20 disabled:opacity-40 transition-all flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" /> Send
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* ═══ SETTINGS TAB ═══ */}
          {activeTab === "settings" && connected && (
            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-5">
              {/* Bot Settings */}
              <motion.div variants={itemVariants} className="glass-panel rounded-xl p-5">
                <h3 className="text-sm font-bold text-white mb-5 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-[#00e5ff]" /> Bot Configuration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <SettingInput
                    label="Bot Name"
                    value={settings?.botName || ""}
                    onChange={(v) => updateSetting("botName", v)}
                    icon={<Bot className="w-3.5 h-3.5 text-[#00e5ff]" />}
                    saving={settingsSaving.botName}
                  />
                  <SettingInput
                    label="Owner Name"
                    value={settings?.ownerName || ""}
                    onChange={(v) => updateSetting("ownerName", v)}
                    icon={<Users className="w-3.5 h-3.5 text-[#e040fb]" />}
                    saving={settingsSaving.ownerName}
                  />
                  <SettingInput
                    label="Prefix"
                    value={settings?.prefix || "."}
                    onChange={(v) => updateSetting("prefix", v)}
                    icon={<Code2 className="w-3.5 h-3.5 text-[#00e676]" />}
                    saving={settingsSaving.prefix}
                  />
                </div>
              </motion.div>

              {/* Feature Toggles */}
              <motion.div variants={itemVariants} className="glass-panel rounded-xl p-5">
                <h3 className="text-sm font-bold text-white mb-5 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#7c4dff]" /> Feature Toggles
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <ToggleSetting
                    label="Public Mode"
                    value={settings?.isPublic ?? false}
                    onChange={(v) => updateSetting("isPublic", v)}
                    desc="Allow everyone to use bot"
                    icon={<Globe className="w-4 h-4" />}
                    saving={settingsSaving.isPublic}
                  />
                  <ToggleSetting
                    label="Anti Spam"
                    value={settings?.antiSpam ?? false}
                    onChange={(v) => updateSetting("antiSpam", v)}
                    desc="Block spammers automatically"
                    icon={<Shield className="w-4 h-4" />}
                    saving={settingsSaving.antiSpam}
                  />
                  <ToggleSetting
                    label="Auto Typing"
                    value={settings?.autoTyping ?? false}
                    onChange={(v) => updateSetting("autoTyping", v)}
                    desc="Show typing indicator"
                    icon={<MessageSquare className="w-4 h-4" />}
                    saving={settingsSaving.autoTyping}
                  />
                  <ToggleSetting
                    label="Auto Read"
                    value={settings?.autoRead ?? false}
                    onChange={(v) => updateSetting("autoRead", v)}
                    desc="Auto-read incoming messages"
                    icon={<Eye className="w-4 h-4" />}
                    saving={settingsSaving.autoRead}
                  />
                  <ToggleSetting
                    label="Welcome Message"
                    value={settings?.welcomeMessage ?? false}
                    onChange={(v) => updateSetting("welcomeMessage", v)}
                    desc="Send welcome on group join"
                    icon={<Bell className="w-4 h-4" />}
                    saving={settingsSaving.welcomeMessage}
                  />
                  <ToggleSetting
                    label="Auto Sticker"
                    value={settings?.autoSticker ?? false}
                    onChange={(v) => updateSetting("autoSticker", v)}
                    desc="Auto-convert images to sticker"
                    icon={<Sparkles className="w-4 h-4" />}
                    saving={settingsSaving.autoSticker}
                  />
                  <ToggleSetting
                    label="Anti Link"
                    value={settings?.antiLink ?? false}
                    onChange={(v) => updateSetting("antiLink", v)}
                    desc="Remove links in groups"
                    icon={<ShieldAlert className="w-4 h-4" />}
                    saving={settingsSaving.antiLink}
                  />
                  <ToggleSetting
                    label="Anti Toxic"
                    value={settings?.antiToxic ?? false}
                    onChange={(v) => updateSetting("antiToxic", v)}
                    desc="Filter toxic messages"
                    icon={<Flame className="w-4 h-4" />}
                    saving={settingsSaving.antiToxic}
                  />
                </div>
              </motion.div>

              {/* Self-Heal Settings */}
              <motion.div variants={itemVariants} className="glass-panel rounded-xl p-5 neon-border-green">
                <h3 className="text-sm font-bold text-white mb-5 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#00e676]" /> Self-Heal Configuration
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <ToggleSetting
                    label="Self-Heal Engine"
                    value={settings?.selfHealEnabled ?? false}
                    onChange={toggleSelfHeal}
                    desc="Enable AI auto-fix for plugin errors"
                    icon={<Shield className="w-4 h-4" />}
                    saving={settingsSaving.selfHealEnabled}
                  />
                  <ToggleSetting
                    label="Auto Fix"
                    value={settings?.selfHealAutoFix ?? false}
                    onChange={(v) => updateSetting("selfHealAutoFix", v)}
                    desc="Apply fixes without manual confirmation"
                    icon={<Wrench className="w-4 h-4" />}
                    saving={settingsSaving.selfHealAutoFix}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <NumberSetting
                    label="Max Cycles"
                    value={settings?.selfHealMaxCycles ?? 3}
                    onChange={(v) => updateSetting("selfHealMaxCycles", v)}
                    min={1}
                    max={10}
                    desc="Maximum fix attempts per error"
                  />
                  <NumberSetting
                    label="Timeout (seconds)"
                    value={Math.round((settings?.selfHealTimeout ?? 30000) / 1000)}
                    onChange={(v) => updateSetting("selfHealTimeout", v * 1000)}
                    min={10}
                    max={120}
                    desc="Timeout per fix cycle"
                  />
                </div>
              </motion.div>
            </motion.div>
          )}
        </main>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════

function StatCard({ icon, label, value, sub, color, trend }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color: string;
  trend?: "good" | "warning" | "danger" | "stable";
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      className="glass-panel rounded-xl p-4 relative overflow-hidden group"
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: `radial-gradient(circle at top right, ${color}08, transparent 70%)` }}
      />
      <div className="flex items-center gap-2 mb-3 relative">
        <div className="p-1.5 rounded-lg" style={{ background: `${color}15`, color }}>
          {icon}
        </div>
        <span className="text-[10px] text-[#8b949e] uppercase font-bold tracking-wider">{label}</span>
        {trend && (
          <div className={`ml-auto w-2 h-2 rounded-full ${
            trend === "good" ? "bg-[#00e676]" :
            trend === "warning" ? "bg-[#ffab00]" :
            trend === "danger" ? "bg-[#ff1744] animate-pulse" :
            "bg-[#8b949e]"
          }`} />
        )}
      </div>
      <div className="text-2xl font-bold text-white relative">{value}</div>
      {sub && <div className="text-[10px] text-[#8b949e] mt-1 relative">{sub}</div>}
    </motion.div>
  );
}

function MiniStat({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <motion.div whileHover={{ scale: 1.02 }} className="glass-panel rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1 rounded-md" style={{ background: `${color}15`, color }}>{icon}</div>
        <span className="text-[10px] text-[#8b949e] uppercase font-bold">{label}</span>
      </div>
      <div className="text-xl font-bold text-white">{value}</div>
    </motion.div>
  );
}

function InfoRow({ icon, label, value, badge }: { icon: React.ReactNode; label: string; value: string; badge?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#21262d]/50 text-sm group hover:bg-[#21262d]/20 px-2 -mx-2 rounded transition-colors">
      <div className="flex items-center gap-2 text-[#8b949e]">
        {icon}
        <span>{label}</span>
      </div>
      {badge ? (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          badge === "green" ? "bg-[#00e676]/15 text-[#00e676] border border-[#00e676]/30" :
          "bg-[#ffab00]/15 text-[#ffab00] border border-[#ffab00]/30"
        }`}>{value}</span>
      ) : (
        <span className="font-mono text-white/90">{value}</span>
      )}
    </div>
  );
}

function ResourceBar({ label, used, total, color, icon }: { label: string; used: number; total: number; color: string; icon: React.ReactNode }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between items-center text-xs mb-1.5">
        <span className="flex items-center gap-1.5 text-[#8b949e]">{icon} {label}</span>
        <span style={{ color }} className="font-mono font-medium">{used} / {total} MB <span className="text-[#484f58]">({pct}%)</span></span>
      </div>
      <div className="h-2.5 bg-[#21262d] rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{
            background: `linear-gradient(90deg, ${color}, ${color}cc)`,
            boxShadow: `0 0 10px ${color}40`,
          }}
        />
      </div>
    </div>
  );
}

function StatusBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className={`w-2 h-2 rounded-full ${active ? "bg-[#00e676] shadow-[0_0_6px_#00e676]" : "bg-[#484f58]"}`} />
      <span className="text-[#8b949e]">{label}:</span>
      <span className={active ? "text-[#00e676] font-medium" : "text-[#484f58]"}>{active ? "ON" : "OFF"}</span>
    </div>
  );
}

function AgentCard({ emoji, name, role, desc, active, color, stats }: {
  emoji: string; name: string; role: string; desc: string; active: boolean; color: string; stats?: any;
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      className={`p-4 rounded-xl border transition-all duration-300 relative overflow-hidden ${
        active
          ? "bg-gradient-to-br from-[#0d1117] to-[#010409]"
          : "bg-[#0d1117]/50 border-[#21262d]"
      }`}
      style={active ? { borderColor: `${color}40` } : {}}
    >
      {active && (
        <div className="absolute inset-0 opacity-10" style={{ background: `radial-gradient(circle at top left, ${color}, transparent 70%)` }} />
      )}
      <div className="relative">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">{emoji}</span>
          <div>
            <div className="text-sm font-bold text-white">{name}</div>
            <div className="text-[10px] font-medium" style={{ color }}>{role}</div>
          </div>
          <div className={`ml-auto w-2.5 h-2.5 rounded-full ${active ? "shadow-lg" : ""}`} style={{ background: active ? color : "#484f58", boxShadow: active ? `0 0 8px ${color}` : "none" }} />
        </div>
        <p className="text-[11px] text-[#8b949e]">{desc}</p>
        {stats && (
          <div className="mt-3 pt-2 border-t border-[#21262d]/50 text-[10px] text-[#484f58]">
            Status: <span className={active ? "text-[#00e676]" : "text-[#ff1744]"}>{stats.status || (active ? "OK" : "Offline")}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function PipelineStep({ label, icon, color }: { label: string; icon: React.ReactNode; color: string }) {
  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium"
      style={{ borderColor: `${color}30`, color, background: `${color}10` }}
    >
      {icon}
      <span>{label}</span>
    </div>
  );
}

function SystemInfoCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="p-3 rounded-lg bg-[#010409] border border-[#21262d] hover:border-[#30363d] transition-all">
      <div className="flex items-center gap-1.5 mb-1.5 text-[#8b949e]">
        {icon}
        <span className="text-[10px] uppercase font-bold">{label}</span>
      </div>
      <div className="text-sm font-mono text-white truncate" title={value}>{value}</div>
    </div>
  );
}

function SettingInput({ label, value, onChange, icon, saving }: {
  label: string; value: string; onChange: (v: string) => void; icon?: React.ReactNode; saving?: boolean;
}) {
  const [val, setVal] = useState(value);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setVal(value); setDirty(false); }, [value]);

  const handleSave = () => {
    if (val !== value) {
      onChange(val);
      setDirty(false);
    }
  };

  return (
    <div>
      <label className="text-[10px] uppercase text-[#8b949e] font-bold mb-1.5 flex items-center gap-1.5">
        {icon} {label}
      </label>
      <div className="flex gap-2">
        <input
          value={val}
          onChange={(e) => { setVal(e.target.value); setDirty(e.target.value !== value); }}
          onKeyDown={(e) => e.key === "Enter" && dirty && handleSave()}
          className="flex-1 bg-[#010409] border border-[#30363d] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#00e5ff] focus:ring-1 focus:ring-[#00e5ff]/20 transition-all"
        />
        {dirty && (
          <motion.button
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2.5 bg-gradient-to-r from-[#00e5ff] to-[#7c4dff] text-white rounded-lg text-xs font-bold hover:shadow-lg disabled:opacity-50 transition-all flex items-center gap-1"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
            Save
          </motion.button>
        )}
      </div>
    </div>
  );
}

function ToggleSetting({ label, value, onChange, desc, icon, saving }: {
  label: string; value: boolean; onChange: (v: boolean) => void; desc: string; icon?: React.ReactNode; saving?: boolean;
}) {
  const handleClick = () => {
    if (!saving) onChange(!value);
  };

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      className="flex items-center justify-between p-3.5 rounded-xl bg-[#010409] border border-[#21262d] hover:border-[#30363d] transition-all group cursor-pointer"
      onClick={handleClick}
    >
      <div className="flex items-center gap-3">
        {icon && (
          <div className={`p-1.5 rounded-lg transition-colors ${value ? "bg-[#00e676]/15 text-[#00e676]" : "bg-[#21262d] text-[#484f58]"}`}>
            {icon}
          </div>
        )}
        <div>
          <div className="text-sm font-medium text-white">{label}</div>
          <div className="text-[10px] text-[#8b949e]">{desc}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {saving && <Loader2 className="w-3 h-3 animate-spin text-[#8b949e]" />}
        <div
          className={`toggle-switch ${value ? "active" : "inactive"}`}
          onClick={(e) => { e.stopPropagation(); handleClick(); }}
        >
          <div className="toggle-thumb" />
        </div>
      </div>
    </motion.div>
  );
}

function NumberSetting({ label, value, onChange, min, max, desc }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; desc: string;
}) {
  const [val, setVal] = useState(value);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setVal(value); setDirty(false); }, [value]);

  const adjust = (delta: number) => {
    const newVal = Math.min(max, Math.max(min, val + delta));
    setVal(newVal);
    setDirty(newVal !== value);
  };

  return (
    <div className="p-3.5 rounded-xl bg-[#010409] border border-[#21262d]">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-sm font-medium text-white">{label}</div>
          <div className="text-[10px] text-[#8b949e]">{desc}</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => adjust(-1)} className="p-1 rounded-md bg-[#21262d] hover:bg-[#30363d] transition-colors">
          <Minus className="w-3.5 h-3.5" />
        </button>
        <div className="flex-1 text-center">
          <span className="text-lg font-bold text-white font-mono">{val}</span>
        </div>
        <button onClick={() => adjust(1)} className="p-1 rounded-md bg-[#21262d] hover:bg-[#30363d] transition-colors">
          <Plus className="w-3.5 h-3.5" />
        </button>
        {dirty && (
          <motion.button
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            onClick={() => { onChange(val); setDirty(false); }}
            className="px-3 py-1 bg-[#00e5ff] text-black rounded-md text-xs font-bold hover:bg-[#00b8d4] transition-all"
          >
            Apply
          </motion.button>
        )}
      </div>
    </div>
  );
}
