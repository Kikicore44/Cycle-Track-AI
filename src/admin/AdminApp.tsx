import React, { useEffect, useMemo, useState } from "react";
import { Shield, Users, LayoutDashboard, LogOut, Server, Search, ArrowLeft, Download, KeyRound, Trash2, UserCog, Plus, Settings, Menu, X, Check, Activity, Sparkles, PieChart, MessageSquare, FileText, Bell, ChevronRight, Circle, Zap } from "lucide-react";
import {
  AdminApiError,
  adminCreateAdmin,
  adminDeleteAdmin,
  adminDeleteUser,
  adminGetStats,
  adminGetDailyStats,
  adminGetUser,
  adminGetUserLogs,
  adminGetUserPeriodDates,
  adminListAdmins,
  adminListUsers,
  adminLogin,
  adminLogout,
  adminMe,
  adminResetAdminPassword,
  adminResetUserPassword,
  adminSignup,
  getAiStatus,
  getDbStatus,
  adminGetCycleMonitoring,
  adminListFeedback,
  adminResolveFeedback,
  adminDeleteFeedback,
  adminListArticles,
  adminSaveArticle,
  adminDeleteArticle,
  adminListNotifications,
  adminCreateNotification,
  adminUpdateNotification,
  adminDeleteNotification,
  adminToggleUserActive,
  adminExportData,
  adminGetRecentActivity,
  adminGetAiAccuracyReport,
  adminGetAiComparisonData,
  adminGetUsersStats,
  adminGetCycleSummary,
  adminListAnonymizedCycles,
  adminUpdateMe,
  adminGetAiSettings,
  adminSaveAiSettings,
} from "./adminApi";
import { AdminUser, clearAdminAuth, getAdminToken, getStoredAdmin, setAdminToken, setStoredAdmin } from "./adminStorage";
import { adminNavigate, useAdminRoute } from "./useAdminRouter";

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const DropletLogo = ({ className, innerColor = "white" }: { className?: string, innerColor?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M12 2C12 2 5 9 5 14.5C5 18.366 8.13401 21.5 12 21.5C15.866 21.5 19 18.366 19 14.5C19 9 12 2 12 2Z" fill="currentColor" />
    <circle cx="9.5" cy="14.5" r="1.5" fill={innerColor} />
    <circle cx="14.5" cy="15.5" r="1.5" fill={innerColor} />
    <circle cx="12" cy="18.5" r="1.5" fill={innerColor} />
    <circle cx="11.5" cy="11.5" r="1" fill={innerColor} />
    <path d="M9.5 14.5L12 18.5L14.5 15.5" stroke={innerColor} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M9.5 14.5L11.5 11.5L14.5 15.5" stroke={innerColor} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

function formatDob(dob: string | null | undefined) {
  if (!dob) return "—";
  return dob;
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function Card({ title, value, icon, trend }: { title: string; value: React.ReactNode; icon?: React.ReactNode; trend?: string }) {
  return (
    <div className="group rounded-3xl border border-white/40 bg-white/70 backdrop-blur-md p-6 shadow-xl shadow-rose-200/50 transition-all duration-300 hover:shadow-rose-500/10 hover:-translate-y-1 overflow-hidden relative">
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-rose-500/5 to-pink-500/10 rounded-bl-full -z-10 group-hover:scale-110 transition-transform duration-500" />
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-bold tracking-wide text-stone-500 uppercase">{title}</div>
        {icon && <div className="opacity-70" style={{ color: "var(--admin-accent)" }}>{icon}</div>}
      </div>
      <div className="flex items-end justify-between gap-4">
        <div className="text-4xl font-extrabold text-stone-800 tracking-tight">{value}</div>
        {trend && <div className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full mb-1">{trend}</div>}
      </div>
    </div>
  );
}

function StatChart({ data, loading }: { data: any[]; loading: boolean }) {
  if (loading) return <div className="h-64 flex items-center justify-center text-stone-400 font-medium">Loading chart data...</div>;
  if (!data?.length) return <div className="h-64 flex items-center justify-center text-stone-400 font-medium">No activity data yet.</div>;

  const max = Math.max(...data.map(d => Math.max(d.logs, 1)), 5);
  const width = 800;
  const height = 240;
  const padding = 40;

  const points = data.map((d, i) => {
    const x = padding + (i * (width - padding * 2)) / (data.length - 1);
    const y = height - padding - (d.logs * (height - padding * 2)) / max;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="w-full overflow-hidden">
      <div className="mb-4 flex items-center justify-between px-2">
        <div className="text-sm font-bold text-stone-700">Symptom Log Activity (Last 30 Days)</div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#c24a72]" />
            <span className="text-[11px] font-bold text-stone-500">Daily Logs</span>
          </div>
        </div>
      </div>
      <svg viewBox={`0 ${height} ${width} ${height}`} className="w-full h-auto overflow-visible" preserveAspectRatio="none">
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c24a72" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#c24a72" stopOpacity="0" />
          </linearGradient>
        </defs>
        
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
          const y = height - padding - p * (height - padding * 2);
          return (
            <line key={i} x1={padding} y1={y} x2={width - padding} y2={y} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 4" />
          );
        })}

        {/* Area */}
        <polygon
          points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`}
          fill="url(#chartGradient)"
        />

        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke="#c24a72"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {data.map((d, i) => {
          const x = padding + (i * (width - padding * 2)) / (data.length - 1);
          const y = height - padding - (d.logs * (height - padding * 2)) / max;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="4"
              fill="white"
              stroke="#c24a72"
              strokeWidth="2"
              className="transition-all hover:r-6 cursor-pointer"
            >
              <title>{d.date}: {d.logs} logs</title>
            </circle>
          );
        })}
      </svg>
      <div className="flex justify-between px-10 mt-2">
         {data.filter((_, i) => i % 5 === 0).map((d, i) => (
           <span key={i} className="text-[10px] font-bold text-stone-400 lowercase">{d.date.slice(5)}</span>
         ))}
      </div>
    </div>
  );
}
function AiComparisonChart({ data, loading }: { data: any[]; loading: boolean }) {
  if (loading) return <div className="h-48 flex items-center justify-center text-stone-400 font-medium">Loading AI metrics...</div>;
  if (!data?.length) return <div className="h-48 flex items-center justify-center text-stone-400 font-medium italic text-sm">Waiting for more prediction validation data.</div>;

  const width = 600;
  const height = 180;
  const padding = 30;
  const centerLine = height / 2;
  const scale = (height - padding * 2) / 10; 

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto drop-shadow-sm">
        <line x1={padding} y1={centerLine} x2={width - padding} y2={centerLine} stroke="#e5e7eb" strokeWidth="2" strokeDasharray="4 4" />
        <text x={padding - 5} y={padding} className="text-[10px] font-black fill-emerald-500" textAnchor="end">FAST</text>
        <text x={padding - 5} y={height - padding + 10} className="text-[10px] font-black fill-rose-500" textAnchor="end">LATE</text>
        {data.map((d, i) => {
          const x = padding + (i * (width - padding * 2)) / (data.length - 1);
          const offset = Math.max(-5, Math.min(5, d.accuracy_offset || 0));
          const y = centerLine + (offset * scale);
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="5" fill={Math.abs(offset) <= 2 ? "#10b981" : "#f43f5e"} />
              {i > 0 && (
                 <line 
                   x1={padding + ((i-1) * (width - padding * 2)) / (data.length - 1)} 
                   y1={centerLine + (Math.max(-5, Math.min(5, data[i-1].accuracy_offset || 0)) * scale)} 
                   x2={x} y2={y} 
                   stroke={Math.abs(offset) <= 2 ? "#10b98144" : "#f43f5e44"} 
                   strokeWidth="2" 
                 />
              )}
            </g>
          );
        })}
      </svg>
      <div className="flex justify-between px-2 mt-2">
        <span className="text-[9px] font-bold text-stone-400 uppercase">Oldest</span>
        <span className="text-[9px] font-bold text-stone-400 uppercase">Latest Validation</span>
      </div>
    </div>
  );
}

function TopError({ error, onClose }: { error: string | null; onClose: () => void }) {
  if (!error) return null;
  return (
    <div className="mx-auto mb-4 max-w-6xl px-4">
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start justify-between gap-3">
        <div>{error}</div>
        <button onClick={onClose} className="text-red-700/70 hover:text-red-800 font-semibold">×</button>
      </div>
    </div>
  );
}

function AuthPage({
  mode,
  onDone,
  onError,
}: {
  mode: "login" | "signup";
  onDone: (result: { admin: AdminUser; token: string }) => void;
  onError: (message: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [role, setRole] = useState("admin");
  const [busy, setBusy] = useState(false);

  const title = mode === "login" ? "Admin Login" : "Admin Signup";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (mode === "signup" && !name)) {
      onError("Please fill in all required fields.");
      return;
    }
    setBusy(true);
    try {
      const result =
        mode === "login"
          ? await adminLogin({ email, password })
          : await adminSignup({ name, email, password, inviteCode: inviteCode || undefined, role });
      onDone({ admin: result.admin, token: result.token });
    } catch (err: any) {
      if (err instanceof AdminApiError) onError(err.message);
      else onError("Authentication failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fdf6f0] to-[#eddff5] flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md rounded-3xl border border-white/20 bg-white/80 backdrop-blur-xl p-8 shadow-2xl shadow-rose-500/10 transition-all duration-300 hover:shadow-rose-500/20">
        <div className="flex items-center gap-4 mb-8">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-[#c24a72] to-[#a83d60] text-white flex items-center justify-center shadow-lg shadow-rose-500/30">
            <DropletLogo className="w-8 h-8 drop-shadow-sm" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-[#903b5c] tracking-tight">Cycle Track AI</div>
            <div className="text-sm font-bold text-[#c24a72]/70 uppercase tracking-widest">{title}</div>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-900"
                  placeholder="Admin Name"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-900"
                  >
                    <option value="admin">admin</option>
                    <option value="manager">manager</option>
                    <option value="developer">developer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Invite Code (optional)</label>
                  <input
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-900"
                    placeholder="If required"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold text-stone-600 mb-1.5 ml-1 uppercase tracking-wider">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border-2 border-stone-100 bg-white/50 px-4 py-3.5 outline-none transition-all duration-200 focus:border-[#c24a72] focus:bg-white focus:ring-4 focus:ring-[#c24a72]/10 placeholder:text-stone-400 font-medium text-stone-700"
              placeholder="admin@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-600 mb-1.5 ml-1 uppercase tracking-wider">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border-2 border-stone-100 bg-white/50 px-4 py-3.5 outline-none transition-all duration-200 focus:border-[#c24a72] focus:bg-white focus:ring-4 focus:ring-[#c24a72]/10 placeholder:text-stone-400 font-medium text-stone-700"
              placeholder="••••••••"
            />
          </div>

          <button
            disabled={busy}
            className="w-full mt-2 rounded-2xl bg-gradient-to-r from-[#c24a72] to-[#a83d60] text-white px-4 py-4 font-bold text-base shadow-lg shadow-rose-500/30 transition-all duration-200 hover:shadow-rose-500/50 hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 active:translate-y-0 active:shadow-md"
          >
            {busy ? "Please wait..." : mode === "login" ? "Login" : "Create Account"}
          </button>
        </form>

        <div className="mt-8 text-center text-sm font-medium text-stone-500">
          {mode === "login" ? (
            <button onClick={() => adminNavigate("/admin/signup")} className="text-[#c24a72] font-bold hover:text-[#903b5c] hover:underline transition-colors focus:outline-none">
              Need an admin account? Sign up
            </button>
          ) : (
            <button onClick={() => adminNavigate("/admin/login")} className="text-[#c24a72] font-bold hover:text-[#903b5c] hover:underline transition-colors focus:outline-none">
              Already have an account? Login
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SidebarNav({
  active,
  onLogout,
}: {
  active: "dashboard" | "users" | "admins" | "settings" | "cycle" | "ai" | "analytics" | "feedback" | "notifications" | "profile";
  onLogout: () => void;
}) {
  const item = (key: typeof active, label: string, icon: React.ReactNode, to: string) => (
    <button
      onClick={() => adminNavigate(to)}
      className={clsx(
        "w-full flex items-center gap-3.5 rounded-2xl px-4 py-3.5 text-sm font-bold transition-all duration-200 group relative overflow-hidden",
        active === key 
          ? "text-[var(--admin-accent)] bg-[var(--admin-accent-soft)] shadow-sm border border-[var(--admin-accent-border)]" 
          : "text-stone-600 hover:text-[var(--admin-accent)] hover:bg-stone-50",
      )}
    >
      {active === key && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-[var(--admin-accent)] rounded-r-full" />}
      <span className={clsx("transition-transform duration-200", active !== key && "group-hover:scale-110")}>
        {icon}
      </span>
      {label}
    </button>
  );

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <div className="flex items-center gap-4 px-3 py-4 mb-4 rounded-3xl bg-gradient-to-r from-[var(--admin-accent-soft)] to-white border border-[var(--admin-accent-border)]">
        <div className="h-12 w-12 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--admin-accent)", boxShadow: "0 12px 28px var(--admin-accent-glow)" }}>
          <DropletLogo className="w-7 h-7 text-[var(--admin-accent-soft)]" innerColor="var(--admin-accent)" />
        </div>
        <div className="min-w-0">
          <div className="text-lg font-extrabold text-[var(--admin-accent-dark)] leading-tight tracking-tight truncate">Cycle Track AI</div>
          <div className="text-[11px] font-bold text-[var(--admin-accent)] uppercase tracking-widest mt-0.5">Admin Portal</div>
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-1.5">
        {item("dashboard", "Dashboard", <LayoutDashboard size={18} />, "/admin/dashboard")}
        {item("users", "Users", <Users size={18} />, "/admin/users")}
        {item("cycle", "Cycle Data", <PieChart size={18} />, "/admin/cycle")}
        {item("ai", "AI Predictions", <Sparkles size={18} />, "/admin/ai")}
        {item("analytics", "Analytics", <Activity size={18} />, "/admin/analytics")}
        {item("feedback", "Feedback", <MessageSquare size={18} />, "/admin/feedback")}
        {item("notifications", "Notifications", <Bell size={18} />, "/admin/notifications")}
        {item("admins", "Admins", <UserCog size={18} />, "/admin/admins")}
        {item("settings", "Settings", <Settings size={18} />, "/admin/settings")}
      </div>

      <div className="mt-auto pt-6 pb-2 border-t border-slate-100">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3.5 rounded-2xl px-4 py-3 text-sm font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all duration-200 group"
        >
          <span className="group-hover:-translate-x-1 transition-transform duration-200">
            <LogOut size={18} />
          </span>
          Logout
        </button>
      </div>
    </div>
  );
}

function DashboardView({ admin }: { admin: AdminUser }) {
  const [stats, setStats] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [aiReport, setAiReport] = useState<any>(null);
  const [dbStatus, setDbStatus] = useState<any>(null);
  const [aiStatus, setAiStatus] = useState<any>(null);
  const [dailyStats, setDailyStats] = useState<any[]>([]);
  const [cycleSummary, setCycleSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadDashboard = async (showLoader: boolean) => {
      if (showLoader) setLoading(true);
      try {
        const [s, act, ai, db, ais, dStats, cycleRes] = await Promise.all([
          adminGetStats(),
          adminGetRecentActivity(),
          adminGetAiAccuracyReport(),
          getDbStatus(),
          getAiStatus(),
          adminGetDailyStats(),
          adminGetCycleSummary()
        ]);
        if (!active) return;
        setStats(s.stats);
        setActivity(act.activity);
        setAiReport(ai.report);
        setDbStatus(db);
        setAiStatus(ais);
        setDailyStats(dStats.stats);
        setCycleSummary(cycleRes.summary);
      } finally {
        if (active && showLoader) setLoading(false);
      }
    };

    loadDashboard(true).catch(() => null);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") loadDashboard(false).catch(() => null);
    }, 15000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const todayStr = new Intl.DateTimeFormat('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date());
  const systemHealthy = dbStatus?.status === "ok" && aiStatus?.status === "healthy";
  const monthlyGrowth = buildMonthlyGrowth(dailyStats);
  const alerts = buildSystemAlerts({ aiReport, aiStatus, dbStatus });
  const recentActivity = activity.slice(0, 6);
  const activeUsers = Array.isArray(stats?.active_users) ? stats.active_users : [];
  const summaryCards = [
    {
      label: "Total Users",
      value: stats?.users ?? 0,
      icon: <Users size={18} />,
      color: "bg-blue-50 text-blue-600",
      note: `${stats?.new_this_month ?? 0} new this month`,
    },
    {
      label: "Active Users Now",
      value: stats?.active_now ?? 0,
      icon: <Activity size={18} />,
      color: "bg-emerald-50 text-emerald-600",
      note: "Seen in the last 5 minutes",
    },
    {
      label: "Used Time Today",
      value: formatDurationCompact(stats?.total_used_today_seconds ?? 0),
      icon: <Zap size={18} />,
      color: "bg-cyan-50 text-cyan-600",
      note: "Combined active time across all users today",
    },
    {
      label: "Total Cycle Records",
      value: stats?.logs ?? 0,
      icon: <PieChart size={18} />,
      color: "bg-rose-50 text-rose-600",
      note: `${stats?.period_dates ?? 0} tracked period dates`,
    },
    {
      label: "Total AI Predictions",
      value: stats?.ai_total ?? 0,
      icon: <Sparkles size={18} />,
      color: "bg-violet-50 text-violet-600",
      note: "Predictions generated by the AI engine",
    },
    {
      label: "Average Cycle Length",
      value: `${stats?.avg_cycle_length ?? 0} days`,
      icon: <CalendarDaysIcon />,
      color: "bg-amber-50 text-amber-600",
      note: "Average across recorded user cycles",
    },
  ];
  const aiOverviewItems = [
    { label: "Total Predictions", value: aiReport?.total ?? stats?.ai_total ?? 0 },
    { label: "Prediction Accuracy", value: `${aiReport?.accuracy ?? 0}%` },
    { label: "Errors", value: aiReport?.mismatches ?? 0 },
    { label: "Last Model Update", value: formatDateTime(aiReport?.lastUpdate) },
  ];

  if (loading) return <div className="flex h-64 items-center justify-center text-sm text-stone-400">Loading Dashboard Command Center...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* HEADER SECTION */}
      <div className="pb-6 border-b border-stone-200/60">
        <div>
          <div className="text-3xl font-extrabold text-[var(--admin-accent-dark)] tracking-tight sm:text-[2rem]">Welcome back, {admin.name}</div>
          <div className="mt-2 flex flex-col gap-1.5 text-sm font-bold text-stone-500 md:flex-row md:items-center md:gap-2">
            <div className="flex items-center gap-2 whitespace-nowrap">
              <Activity size={16} className="text-[var(--admin-accent)]" />
              <span>{todayStr}</span>
            </div>
            <span className="hidden md:inline text-stone-300">•</span>
            <div className="flex items-center gap-2 whitespace-nowrap">
              <Server size={16} className="text-emerald-600" />
              <span className="text-emerald-600">System running normally</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        {summaryCards.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            icon={card.icon}
            color={card.color}
            note={card.note}
          />
        ))}
      </div>

      <div className="rounded-3xl border border-white bg-white/70 p-6 shadow-xl shadow-stone-200/50">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-6">
          <div>
            <h3 className="font-extrabold text-stone-800 flex items-center gap-2"><Users size={20}/> Current Active Users</h3>
            <p className="text-sm text-stone-500 mt-1">Users with a recent heartbeat in the last 5 minutes</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-emerald-50 px-4 py-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Active Now</div>
              <div className="mt-1 text-xl font-black text-emerald-700">{stats?.active_now ?? 0}</div>
            </div>
            <div className="rounded-2xl bg-cyan-50 px-4 py-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-cyan-600">Used Today</div>
              <div className="mt-1 text-xl font-black text-cyan-700">{formatDurationCompact(stats?.total_used_today_seconds ?? 0)}</div>
            </div>
          </div>
        </div>

        {activeUsers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/60 p-8 text-center">
            <div className="text-base font-bold text-stone-700">No users are active right now.</div>
            <div className="mt-2 text-sm text-stone-500">This section updates automatically when someone starts using the app.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {activeUsers.map((item: any) => (
              <div key={item.user_id} className="rounded-2xl border border-stone-100 bg-stone-50/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold text-stone-800 truncate">{item.user_name || `User #${item.user_id}`}</div>
                    <div className="text-sm text-stone-500 truncate">{item.email}</div>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                    Active
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white px-3 py-2">
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Used Today</div>
                    <div className="mt-1 text-sm font-bold text-stone-800">{formatDurationCompact(item.active_seconds_today)}</div>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2">
                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Last Seen</div>
                    <div className="mt-1 text-sm font-bold text-stone-800">{formatRelativeTime(item.last_seen_at)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-8">
          <div className="rounded-3xl border border-white bg-white/70 shadow-xl shadow-stone-200/50 p-7 h-full">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-extrabold text-stone-800 flex items-center gap-2"><Activity size={20}/> User Growth</h3>
                <p className="text-sm text-stone-500 mt-1">Monthly user growth across the admin platform</p>
              </div>
              <span className="text-xs font-bold text-stone-400">Monthly overview</span>
            </div>
            <MonthlyGrowthChart data={monthlyGrowth} />
          </div>
        </div>

        <div className="xl:col-span-4">
          <div className="rounded-3xl border border-white bg-white/70 p-7 shadow-xl shadow-stone-200/50 h-full">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-extrabold text-stone-800 flex items-center gap-2"><Sparkles size={20}/> AI Overview</h3>
                <p className="text-sm text-stone-500 mt-1">Core performance signals for the prediction engine</p>
              </div>
              <span className={clsx("text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg", systemHealthy ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-700")}>
                {systemHealthy ? "Stable" : "Needs review"}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4">
              {aiOverviewItems.map((item) => (
                <div key={item.label} className="rounded-2xl border border-stone-100 bg-stone-50/80 p-4">
                  <div className="text-[11px] font-black uppercase tracking-widest text-stone-400">{item.label}</div>
                  <div className="mt-2 text-2xl font-black text-stone-800">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        <div className="rounded-3xl border border-white bg-white/70 p-5 sm:p-7 shadow-xl shadow-stone-200/50 h-full">
            <h3 className="font-extrabold text-stone-800 mb-5 flex items-center gap-2 text-sm sm:text-base"><PieChart size={18}/> Cycle Distribution</h3>
            <DistributionPieChart distribution={cycleSummary?.distribution} />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-8 xl:grid-cols-12">
          <div className="rounded-3xl border border-white bg-white/70 p-5 sm:p-7 shadow-xl shadow-stone-200/50 h-full xl:col-span-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-extrabold text-stone-800 flex items-center gap-2 text-sm sm:text-base"><Server size={20}/> System Alerts</h3>
              </div>
              <span className={clsx("text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg", alerts.some((alert) => alert.level === "critical") ? "bg-rose-50 text-rose-600" : alerts.some((alert) => alert.level === "warning") ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-600")}>
                {alerts.some((alert) => alert.level === "critical") ? "Critical" : alerts.some((alert) => alert.level === "warning") ? "Warning" : "Healthy"}
              </span>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {alerts.map((alert) => (
                <div key={alert.title} className={clsx("rounded-2xl border p-4", alert.level === "critical" ? "border-rose-200 bg-rose-50/80" : alert.level === "warning" ? "border-amber-200 bg-amber-50/80" : "border-emerald-200 bg-emerald-50/80")}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-bold text-stone-800">{alert.title}</div>
                    <span className={clsx("rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest", alert.level === "critical" ? "bg-rose-100 text-rose-700" : alert.level === "warning" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700")}>
                      {alert.level}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-stone-600">{alert.message}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl bg-stone-900 p-5 sm:p-7 shadow-xl shadow-stone-900/20 text-white h-full xl:col-span-4">
            <h3 className="font-extrabold mb-5 flex items-center gap-2 text-sm sm:text-base"><Zap size={18} className="text-[#f4c95d]"/> Quick Actions</h3>
            <div className="grid grid-cols-1 gap-3">
              <ActionButton label="View Users" icon={<Users size={16}/>} onClick={() => adminNavigate("/admin/users")} />
              <ActionButton label="Send Notification" icon={<Bell size={16}/>} onClick={() => adminNavigate("/admin/notifications")} />
              <ActionButton label="View Reports" icon={<Download size={16}/>} onClick={() => adminNavigate("/admin/analytics")} />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-white bg-white/70 p-7 shadow-xl shadow-stone-200/50">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-extrabold text-stone-800 flex items-center gap-2"><Activity size={20}/> Recent Activity</h3>
          <button onClick={() => adminNavigate("/admin/users")} className="text-xs font-bold text-[var(--admin-accent)] hover:underline">View Users</button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {recentActivity.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-200 p-6 text-sm text-stone-400 text-center lg:col-span-2">No recent activity found.</div>
          ) : recentActivity.map((item, index) => (
            <div key={`${item.user_id}-${item.timestamp}-${index}`} className="flex items-start gap-4 rounded-2xl border border-stone-100 bg-stone-50/70 p-4">
              <div className={clsx("mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-black", activityTone(item.action).badge)}>
                {item.user_name?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-stone-800">{item.user_name || `User #${item.user_id}`}</span>
                  <span className={clsx("rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest", activityTone(item.action).pill)}>
                    {activityTone(item.action).label}
                  </span>
                </div>
                <p className="mt-1 text-sm text-stone-600">{humanizeAction(item.action)}</p>
                <p className="mt-2 text-xs text-stone-400">{formatDateTime(item.timestamp)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color, note, className }: any) {
  return (
    <div className={clsx("rounded-3xl border border-white bg-white/70 p-4 sm:p-5 shadow-lg shadow-stone-200/40 hover:shadow-xl hover:translate-y-[-2px] transition-all duration-300", className)}>
      <div className={`h-10 w-10 rounded-2xl ${color} flex items-center justify-center mb-4`}>
        {icon}
      </div>
      <div className="text-lg sm:text-2xl font-black text-stone-800">{value}</div>
      <div className="text-[10px] sm:text-[11px] font-bold text-stone-400 uppercase tracking-widest mt-1 leading-snug">{label}</div>
      {note && <div className="mt-2 text-[11px] sm:text-xs font-medium text-stone-500 leading-relaxed">{note}</div>}
    </div>
  );
}

function ProgressItem({ label, value, color }: any) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-bold">
        <span className="text-stone-500">{label}</span>
        <span className="text-stone-800">{value}%</span>
      </div>
      <div className="h-2 w-full bg-stone-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function HealthItem({ label, status, value }: any) {
  return (
    <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50/50 border border-stone-100">
       <span className="text-sm font-bold text-stone-600">{label}</span>
       <div className="flex items-center gap-2">
          {value && <span className="text-xs font-black text-stone-800 mr-2">{value}</span>}
          <div className={`h-2 w-2 rounded-full ${status === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'}`} />
          <span className={`text-[10px] font-black uppercase tracking-tighter ${status === 'online' ? 'text-emerald-600' : 'text-rose-600'}`}>{status}</span>
       </div>
    </div>
  );
}

function UserLogBarChart({ logs }: { logs: Array<{ date: string; pain: number | null; symptoms: string[]; mood?: string | null }> | null }) {
  if (logs === null) {
    return <div className="flex h-32 items-center justify-center text-sm text-stone-400">Loading activity graph...</div>;
  }
  if (!logs.length) {
    return <div className="flex h-32 items-center justify-center text-sm text-stone-400">No cycle logs available yet.</div>;
  }

  const recentLogs = [...logs]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-7);

  return (
    <div className="space-y-4">
      <div className="flex h-32 items-end gap-2">
        {recentLogs.map((log) => {
          const painValue = log.pain === null ? null : Math.max(0, Math.min(10, Number(log.pain)));
          const symptomWeight = Math.min((log.symptoms?.length || 0) * 2, 6);
          const moodWeight = log.mood ? 1 : 0;
          const activityScore = painValue !== null ? painValue : Math.min(10, symptomWeight + moodWeight + 2);
          const height = Math.max(20, (activityScore / 10) * 100);
          return (
            <div key={`${log.date}-${activityScore}`} className="flex flex-1 flex-col items-center gap-2">
              <div className="w-full rounded-t-2xl bg-[var(--admin-accent-soft)]" style={{ height: `${height}%` }}>
                <div
                  className="w-full rounded-t-2xl"
                  style={{
                    height: "100%",
                    background: "linear-gradient(180deg, var(--admin-accent), var(--admin-accent-dark))",
                  }}
                  title={`${log.date} • Pain ${painValue}/10 • ${log.symptoms.length} symptoms`}
                />
              </div>
              <div className="text-[10px] font-bold text-stone-400">{log.date.slice(5)}</div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-xs font-medium text-stone-500">
        <span>Recent activity from logs</span>
        <span>0 - 10 scale</span>
      </div>
    </div>
  );
}

function UserPainTrendChart({ logs }: { logs: Array<{ date: string; pain: number | null; symptoms: string[]; mood?: string | null }> | null }) {
  if (logs === null) {
    return <div className="flex h-32 items-center justify-center text-sm text-stone-400">Loading activity graph...</div>;
  }
  if (!logs.length) {
    return <div className="flex h-32 items-center justify-center text-sm text-stone-400">No cycle logs available yet.</div>;
  }

  const recentLogs = [...logs]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-7);
  const chartHeight = 180;
  const leftPad = 28;
  const rightPad = 16;
  const topPad = 16;
  const bottomPad = 28;
  const chartWidth = 440;
  const chartData = recentLogs.map((log) => {
    const painValue = log.pain === null ? null : Math.max(0, Math.min(10, Number(log.pain)));
    const symptomWeight = Math.min((log.symptoms?.length || 0) * 2, 6);
    const moodWeight = log.mood ? 1 : 0;
    const score = painValue !== null ? painValue : Math.min(10, symptomWeight + moodWeight + 2);
    return { ...log, painValue, score: Math.max(0, Math.min(10, score)) };
  });
  const points = chartData.map((log, index) => {
    const x = chartData.length === 1
      ? chartWidth / 2
      : leftPad + (index * (chartWidth - leftPad - rightPad)) / Math.max(chartData.length - 1, 1);
    const y = topPad + (1 - log.score / 10) * (chartHeight - topPad - bottomPad);
    return { ...log, x, y };
  });
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPoints = `${leftPad},${chartHeight - bottomPad} ${linePoints} ${chartWidth - rightPad},${chartHeight - bottomPad}`;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-stone-100 bg-gradient-to-b from-white to-stone-50/80 p-3">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto">
        <defs>
          <linearGradient id="userPainArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--admin-accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--admin-accent)" stopOpacity="0.03" />
          </linearGradient>
        </defs>
        {[0, 5, 10].map((tick) => {
          const y = topPad + (1 - tick / 10) * (chartHeight - topPad - bottomPad);
          return (
            <g key={tick}>
              <line x1={leftPad} y1={y} x2={chartWidth - rightPad} y2={y} stroke="#e7e5e4" strokeDasharray="4 4" />
              <text x={2} y={y + 4} className="fill-stone-400 text-[10px] font-bold">
                {tick}
              </text>
            </g>
          );
        })}
        <polygon fill="url(#userPainArea)" points={areaPoints} />
        <polyline fill="none" stroke="var(--admin-accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={linePoints} />
        {points.map((log) => {
          return (
            <g key={`${log.date}-${log.score}`}>
              <circle cx={log.x} cy={log.y} r="6" fill="white" stroke="var(--admin-accent)" strokeWidth="3">
                <title>{`${log.date} • Pain ${log.painValue ?? log.score}/10 • ${log.symptoms.length} symptoms`}</title>
              </circle>
              <text x={log.x} y={chartHeight - 6} textAnchor="middle" className="fill-stone-400 text-[10px] font-bold">
                {log.date.slice(5)}
              </text>
            </g>
          );
        })}
      </svg>
      </div>
      <div className="flex items-center justify-between text-xs font-medium text-stone-500">
        <span>Recent pain pattern from logs</span>
        <span>0 - 10 scale</span>
      </div>
    </div>
  );
}

function ActionButton({ label, icon, onClick }: any) {
  return (
    <button onClick={onClick} className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-left">
       <div className="flex items-center gap-3">
         <div className="text-white/70">{icon}</div>
         <span className="text-xs font-bold uppercase tracking-widest text-white/90">{label}</span>
       </div>
       <ChevronRight size={16} className="text-white/50" />
    </button>
  );
}

function MonthlyGrowthChart({ data }: { data: Array<{ label: string; value: number; fullLabel: string }> }) {
  if (!data.length) return <div className="h-64 flex items-center justify-center text-stone-400 font-medium">No user growth data available yet.</div>;

  const max = Math.max(...data.map((item) => item.value), 1);
  const width = 760;
  const height = 260;
  const paddingX = 40;
  const paddingY = 28;

  const points = data.map((item, index) => {
    const x = data.length === 1 ? width / 2 : paddingX + (index * (width - paddingX * 2)) / (data.length - 1);
    const y = height - paddingY - (item.value * (height - paddingY * 2)) / max;
    return { x, y, ...item };
  });

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        <defs>
          <linearGradient id="monthlyGrowthArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c24a72" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#c24a72" stopOpacity="0.03" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((step) => {
          const y = height - paddingY - step * (height - paddingY * 2);
          return <line key={step} x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="#e7e5e4" strokeDasharray="4 4" />;
        })}
        <polygon
          fill="url(#monthlyGrowthArea)"
          points={[
            `${points[0].x},${height - paddingY}`,
            ...points.map((point) => `${point.x},${point.y}`),
            `${points[points.length - 1].x},${height - paddingY}`,
          ].join(" ")}
        />
        <polyline
          fill="none"
          stroke="#c24a72"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points.map((point) => `${point.x},${point.y}`).join(" ")}
        />
        {points.map((point) => (
          <g key={point.fullLabel}>
            <circle cx={point.x} cy={point.y} r="5" fill="#fff" stroke="#c24a72" strokeWidth="3" />
            <title>{`${point.fullLabel}: ${point.value} users`}</title>
          </g>
        ))}
      </svg>
      <div className="mt-4 grid grid-cols-3 sm:grid-cols-6 gap-2">
        {data.map((item) => (
          <div key={item.fullLabel} className="rounded-2xl bg-stone-50 border border-stone-100 px-3 py-2 text-center">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">{item.label}</div>
            <div className="mt-1 text-sm font-bold text-stone-800">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildMonthlyGrowth(dailyStats: Array<{ date: string; users: number }>) {
  const monthlyMap = new Map<string, { label: string; value: number; fullLabel: string }>();

  dailyStats.forEach((item) => {
    const date = new Date(item.date);
    if (Number.isNaN(date.getTime())) return;
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const label = date.toLocaleDateString("en-US", { month: "short" });
    const fullLabel = date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const current = monthlyMap.get(key);
    const nextValue = Math.max(current?.value ?? 0, item.users ?? 0);
    monthlyMap.set(key, { label, value: nextValue, fullLabel });
  });

  return Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([, value]) => value);
}

function buildSystemAlerts({ aiReport, aiStatus, dbStatus }: { aiReport: any; aiStatus: any; dbStatus: any }) {
  const alerts = [];

  if ((aiReport?.accuracy ?? 100) < 85) {
    alerts.push({
      title: "Prediction accuracy is below target",
      message: `Current accuracy is ${aiReport?.accuracy ?? 0}%. Review recent mismatches and retrain if needed.`,
      level: "warning",
    });
  }

  if ((aiReport?.mismatches ?? 0) > 10) {
    alerts.push({
      title: "Prediction errors are increasing",
      message: `${aiReport?.mismatches ?? 0} mismatches were recorded in the latest validation data.`,
      level: "critical",
    });
  }

  if (dbStatus?.status !== "ok") {
    alerts.push({
      title: "Database connection issue detected",
      message: "The database health check is not reporting a healthy status.",
      level: "critical",
    });
  }

  if (aiStatus?.status !== "healthy") {
    alerts.push({
      title: "AI service needs attention",
      message: "The AI engine is not reporting a healthy status. Check service logs and model availability.",
      level: "warning",
    });
  }

  if (!alerts.length) {
    alerts.push({
      title: "No active system alerts",
      message: "Prediction quality and infrastructure checks are all within expected ranges.",
      level: "healthy",
    });
  }

  return alerts;
}

function humanizeAction(action: string) {
  return action
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function activityTone(action: string) {
  const normalized = action.toLowerCase();

  if (normalized.includes("register")) {
    return {
      label: "Registration",
      badge: "bg-blue-100 text-blue-700",
      pill: "bg-blue-100 text-blue-700",
    };
  }

  if (normalized.includes("log") || normalized.includes("cycle") || normalized.includes("period")) {
    return {
      label: "Cycle Log",
      badge: "bg-rose-100 text-rose-700",
      pill: "bg-rose-100 text-rose-700",
    };
  }

  return {
    label: "Update",
    badge: "bg-amber-100 text-amber-700",
    pill: "bg-amber-100 text-amber-700",
  };
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatDurationCompact(totalSeconds: number | null | undefined) {
  const safeSeconds = Math.max(0, Number(totalSeconds ?? 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${safeSeconds}s`;
}

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "No recent signal";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No recent signal";
  const diffSeconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));

  if (diffSeconds < 60) return "Just now";
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} min ago`;
  return `${Math.floor(diffSeconds / 3600)} hr ago`;
}

function formatDate(value: string | null | undefined, fallback = "—") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString();
}

function calculateAge(dob: string | null) {
  if (!dob) return "—";
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function DistributionPieChart({ distribution }: { distribution?: { short: number; normal: number; long: number } }) {
  const short = distribution?.short ?? 0;
  const normal = distribution?.normal ?? 0;
  const long = distribution?.long ?? 0;
  const total = Math.max(short + normal + long, 1);
  const radius = 82;
  const circumference = 2 * Math.PI * radius;
  const segments = [
    { label: "Short", value: short, color: "#f59e0b" },
    { label: "Normal", value: normal, color: "#10b981" },
    { label: "Long", value: long, color: "#6366f1" },
  ];

  let offset = 0;

  return (
    <div className="flex items-center gap-4 sm:gap-6 lg:justify-between">
      <div className="relative flex h-40 w-40 items-center justify-center md:h-64 md:w-64">
        <svg viewBox="0 0 220 220" className="h-40 w-40 -rotate-90 md:h-64 md:w-64">
          <circle cx="110" cy="110" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="24" />
          {segments.map((segment) => {
            const strokeDasharray = `${(segment.value / total) * circumference} ${circumference}`;
            const circle = (
              <circle
                key={segment.label}
                cx="110"
                cy="110"
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth="24"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={-offset}
                strokeLinecap="round"
              />
            );
            offset += (segment.value / total) * circumference;
            return circle;
          })}
        </svg>
        <div className="absolute text-center">
          <div className="text-2xl font-black text-stone-800 md:text-4xl">{total}</div>
          <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 md:text-xs">Records</div>
        </div>
      </div>
      <div className="grid flex-1 gap-3">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center justify-between rounded-2xl border border-stone-100 bg-stone-50 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: segment.color }} />
              <span className="text-sm font-bold text-stone-700">{segment.label}</span>
            </div>
            <span className="text-sm font-black text-stone-800">{segment.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function getAdminThemePalette(theme: "rose" | "teal" | "dark") {
  if (theme === "teal") {
    return {
      accent: "#0d9488",
      accentDark: "#0f766e",
      accentSoft: "#ccfbf1",
      accentBorder: "#99f6e4",
      accentGlow: "rgba(13, 148, 136, 0.18)",
      accentGradientStart: "#14b8a6",
      accentGradientEnd: "#0f766e",
    };
  }
  if (theme === "dark") {
    return {
      accent: "#f43f5e",
      accentDark: "#be123c",
      accentSoft: "#2a1018",
      accentBorder: "#5a2230",
      accentGlow: "rgba(244, 63, 94, 0.2)",
      accentGradientStart: "#f43f5e",
      accentGradientEnd: "#be123c",
    };
  }
  return {
    accent: "#c24a72",
    accentDark: "#903b5c",
    accentSoft: "#eddff5",
    accentBorder: "#d8c5e3",
    accentGlow: "rgba(194, 74, 114, 0.18)",
    accentGradientStart: "#c24a72",
    accentGradientEnd: "#a83d60",
  };
}

function CalendarDaysIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <path d="M3 10h18" />
      <path d="M8 14h.01" />
      <path d="M12 14h.01" />
      <path d="M16 14h.01" />
    </svg>
  );
}

function UsersView({ onOpenUser }: { onOpenUser: (id: number) => void }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const pageSize = 15;

  const loadData = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const [uData, sData] = await Promise.all([
        adminListUsers({ q, status, limit: pageSize, offset: page * pageSize }),
        adminGetUsersStats()
      ]);
      setUsers(uData.users);
      setTotal(uData.total);
      setStats(sData.stats);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    loadData().catch(() => null);
  }, [page, status]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") loadData(false).catch(() => null);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [page, q, status]);

  const toggleStatus = async (id: number, current: number) => {
    await adminToggleUserActive(id, current === 0);
    await loadData(false);
  };

  const deleteUser = async (id: number) => {
    if (!window.confirm("Delete this user permanently?")) return;
    await adminDeleteUser(id);
    await loadData(false);
  };

  const calculateAge = (dob: string | null) => {
    if (!dob) return "—";
    const birth = new Date(dob);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* PAGE HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-2">
        <div>
          <h2 className="text-2xl font-extrabold text-[var(--admin-accent-dark)] tracking-tight">User Management</h2>
        </div>
        <div className="grid w-full gap-3 md:flex md:w-auto md:max-w-none md:items-center">
          <div className="relative min-w-0 md:w-72">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(0);
                  loadData().catch(() => null);
                }
              }}
              className="w-full rounded-2xl border-2 border-stone-100 bg-white px-11 py-2.5 text-sm outline-none focus:border-[var(--admin-accent)] transition-all font-medium"
              placeholder="Search by name or email"
            />
          </div>
          <select 
            value={status} 
            onChange={(e) => { setStatus(e.target.value); setPage(0); }}
            className="rounded-2xl border-2 border-stone-100 bg-white px-4 py-2.5 text-sm font-bold outline-none focus:border-[var(--admin-accent)] transition-all text-stone-600 appearance-none min-w-[120px] sm:min-w-[150px]"
          >
            <option value="">All Users</option>
            <option value="active">Active Users</option>
            <option value="inactive">Inactive Users</option>
          </select>
          <button onClick={() => { setPage(0); loadData().catch(() => null); }} className="rounded-2xl bg-stone-900 px-4 py-3 text-sm font-bold text-white hover:bg-stone-800 transition-all shadow-md whitespace-nowrap md:p-3">
             <span className="md:hidden">Search</span>
             <span className="hidden md:inline-flex"><Search size={18} /></span>
          </button>
        </div>
      </div>

      {/* USER STATISTICS SUMMARY */}
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        <div className="bg-white p-5 rounded-3xl border border-white shadow-xl shadow-stone-200/50 flex items-center gap-4">
           <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
             <Users size={22} />
           </div>
           <div>
             <div className="text-2xl font-black text-stone-800">{stats?.total ?? 0}</div>
             <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Total Users</div>
           </div>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-white shadow-xl shadow-stone-200/50 flex items-center gap-4">
           <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
             <Activity size={22} />
           </div>
           <div>
             <div className="text-2xl font-black text-stone-800">{stats?.active_today ?? 0}</div>
             <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Active Today</div>
           </div>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-white shadow-xl shadow-stone-200/50 flex items-center gap-4">
           <div className="h-12 w-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
             <Plus size={22} />
           </div>
           <div>
             <div className="text-2xl font-black text-stone-800">{stats?.new_this_month ?? 0}</div>
             <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">New This Month</div>
           </div>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-white shadow-xl shadow-stone-200/50 flex items-center gap-4">
           <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
             <X size={22} />
           </div>
           <div>
             <div className="text-2xl font-black text-stone-800">{stats?.inactive ?? 0}</div>
             <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Inactive Users</div>
           </div>
        </div>
      </div>

      <div className="space-y-6">
          <div className="rounded-3xl border border-white bg-white/70 backdrop-blur-xl shadow-xl shadow-stone-200/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-stone-50/50 text-[10px] font-black uppercase text-stone-400 tracking-widest border-b border-stone-100">
                  <tr>
                    <th className="px-6 py-4">User ID</th>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Age</th>
                    <th className="px-6 py-4">Account Status</th>
                    <th className="px-6 py-4">Last Login Date</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {loading ? (
                    <tr><td colSpan={7} className="px-6 py-12 text-center text-stone-400 font-medium">Fetching users...</td></tr>
                  ) : users.length === 0 ? (
                    <tr><td colSpan={7} className="px-6 py-12 text-center text-stone-400 font-medium text-sm italic">No users found for the current search or filter.</td></tr>
                  ) : users.map((u) => (
                    <tr key={u.id} className="hover:bg-stone-50/50 transition-colors group">
                      <td className="px-6 py-4 text-sm font-bold text-stone-500">#{u.id}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                           <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-stone-100 to-stone-50 flex items-center justify-center text-xs font-bold text-stone-500 border border-stone-100 group-hover:from-[#c24a72] group-hover:to-[#a83d60] group-hover:text-white transition-all">
                              {u.name?.charAt(0) || 'U'}
                           </div>
                           <div className="flex flex-col">
                              <span className="text-sm font-bold text-stone-800 group-hover:text-[#c24a72] transition-colors">{u.name || `User #${u.id}`}</span>
                           </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-stone-600">{u.email}</td>
                      <td className="px-6 py-4 text-sm font-bold text-stone-600">
                        {calculateAge(u.dob)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={clsx(
                          "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight",
                          u.is_active ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                        )}>
                          {u.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-stone-400 font-medium">
                        {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                           <button onClick={() => onOpenUser(u.id)} className="p-2 text-stone-400 hover:text-[#c24a72] transition-colors" title="View Profile">
                             <UserCog size={16} />
                           </button>
                           <button onClick={() => toggleStatus(u.id, u.is_active)} className={clsx("p-2 transition-colors", u.is_active ? "text-amber-400 hover:text-amber-600" : "text-emerald-400 hover:text-emerald-600")} title={u.is_active ? "Deactivate" : "Activate"}>
                             <Shield size={16} />
                           </button>
                           <button onClick={() => deleteUser(u.id)} className="p-2 text-stone-400 hover:text-rose-600 transition-colors" title="Delete Account">
                             <Trash2 size={16} />
                           </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* PAGINATION */}
          <div className="flex items-center justify-between px-2">
            <div className="text-xs font-bold text-stone-400">
              Showing <span className="text-stone-700">{users.length}</span> of <span className="text-stone-700">{total}</span> users
            </div>
            <div className="flex items-center gap-2">
              <button 
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                className="px-4 py-2 rounded-xl bg-white border border-stone-200 text-xs font-bold text-stone-600 disabled:opacity-50 hover:border-[#c24a72] transition-all"
              >
                Previous
              </button>
              <button 
                disabled={(page + 1) * pageSize >= total}
                onClick={() => setPage(p => p + 1)}
                className="px-4 py-2 rounded-xl bg-white border border-stone-200 text-xs font-bold text-stone-600 disabled:opacity-50 hover:border-[#c24a72] transition-all"
              >
                Next
              </button>
            </div>
          </div>
      </div>
    </div>
  );
}

function UserDetailView({ userId, onBack }: { userId: number; onBack: () => void }) {
  const [user, setUser] = useState<{ id: number; name: string; email: string; dob: string | null; predictionsCount: number; lastCycleDate: string | null; is_active?: number } | null>(null);
  const [summary, setSummary] = useState<{ logsCount: number; periodDatesCount: number } | null>(null);
  const [tab, setTab] = useState<"summary" | "logs" | "periods">("summary");
  const [logs, setLogs] = useState<any[] | null>(null);
  const [dates, setDates] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const loadUser = async (showLoader: boolean) => {
      if (showLoader) setLoading(true);
      try {
        const [data, logsData, datesData] = await Promise.all([
          adminGetUser(userId),
          adminGetUserLogs(userId),
          adminGetUserPeriodDates(userId),
        ]);
        if (!mounted) return;
        setUser(data.user);
        setSummary(data.summary);
        setLogs(logsData.logs);
        setDates(datesData.dates);
      } finally {
        if (mounted && showLoader) setLoading(false);
      }
    };

    loadUser(true).catch(() => null);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") loadUser(false).catch(() => null);
    }, 15000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [userId]);

  const loadLogs = async () => {
    if (logs) return;
    const data = await adminGetUserLogs(userId);
    setLogs(data.logs);
  };

  const loadDates = async () => {
    if (dates) return;
    const data = await adminGetUserPeriodDates(userId);
    setDates(data.dates);
  };

  useEffect(() => {
    if (tab === "logs") loadLogs().catch(() => null);
    if (tab === "periods") loadDates().catch(() => null);
  }, [tab, userId]);

  const sortedLogs = useMemo(() => {
    return [...(logs ?? [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [logs]);

  const recentLogs = sortedLogs.slice(-7);
  const recentLogCoverage = sortedLogs.filter((log) => {
    const diff = Date.now() - new Date(log.date).getTime();
    return diff >= 0 && diff <= 30 * 24 * 60 * 60 * 1000;
  }).length;
  const coverageScore = Math.min(100, Math.round((recentLogCoverage / 30) * 100));
  const averagePain = sortedLogs.length
    ? (sortedLogs.reduce((sum, log) => sum + Number(log.pain ?? 0), 0) / sortedLogs.length).toFixed(1)
    : "0.0";
  const commonMood = useMemo(() => {
    const entries = sortedLogs
      .map((log) => String(log.mood || "").trim())
      .filter(Boolean);
    if (!entries.length) return "No mood data";
    const counts = new Map<string, number>();
    for (const mood of entries) counts.set(mood, (counts.get(mood) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }, [sortedLogs]);
  const firstActivityDate = sortedLogs[0]?.date || null;

  const doExport = async () => {
    const [logsData, datesData] = await Promise.all([
      logs ? Promise.resolve({ logs }) : adminGetUserLogs(userId),
      dates ? Promise.resolve({ dates }) : adminGetUserPeriodDates(userId),
    ]);
    downloadJson(`user-${userId}-export.json`, {
      user,
      summary,
      logs: logsData.logs,
      periodDates: datesData.dates,
      exportedAt: new Date().toISOString(),
    });
  };

  const doResetPassword = async () => {
    const next = window.prompt("Enter a new password for this user:");
    if (!next) return;
    await adminResetUserPassword(userId, next);
    window.alert("Password updated.");
  };

  const doDelete = async () => {
    const ok = window.confirm("Delete this user and all their logs/period dates? This cannot be undone.");
    if (!ok) return;
    await adminDeleteUser(userId);
    window.alert("User deleted.");
    onBack();
  };

  if (loading && !user) {
    return <div className="h-64 flex items-center justify-center text-stone-400 font-medium">Loading user data...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-bold text-stone-500 hover:text-[#c24a72] transition-colors group">
          <div className="group-hover:-translate-x-1 transition-transform bg-white border border-stone-200 shadow-sm p-2 rounded-2xl">
            <ArrowLeft size={16} />
          </div>
          <span className="hidden sm:inline">Back to Users</span>
        </button>
        <div className="flex items-center gap-3">
          <button onClick={doExport} className="p-2.5 rounded-2xl bg-white border border-stone-200 text-stone-600 hover:text-[#c24a72] hover:border-rose-200 transition-all shadow-sm">
            <Download size={18} />
          </button>
          <button onClick={doDelete} className="p-2.5 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-600 hover:text-white transition-all shadow-sm">
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-6">
          <div className="rounded-3xl border border-white/40 bg-white/70 backdrop-blur-xl shadow-xl shadow-stone-200/50 p-8 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#c24a72]/10 to-transparent rounded-bl-full" />
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#c24a72] to-[#a83d60] flex items-center justify-center text-white text-3xl font-extrabold shadow-lg mb-4">
                {(user?.name || "?")[0].toUpperCase()}
              </div>
              <h2 className="text-lg font-extrabold text-stone-800 break-all">{user?.name}</h2>
              <p className="text-sm text-stone-500 font-medium mb-6 break-all">{user?.email}</p>
              
              <div className="w-full grid grid-cols-3 gap-2 border-t border-stone-100 pt-6">
                <div>
                  <div className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">Cycle Logs</div>
                  <div className="text-base font-extrabold text-stone-800">{summary?.logsCount ?? 0}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">Cycle Count</div>
                  <div className="text-base font-extrabold text-stone-800">{summary?.periodDatesCount ?? 0}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">Predictions</div>
                  <div className="text-base font-extrabold text-[var(--admin-accent)]">{user?.predictionsCount ?? 0}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/40 bg-white/40 p-6 space-y-4">
            <div className="text-sm font-bold text-stone-700">Insights & Health</div>
            <div className="space-y-3">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-stone-500">Last Cycle Logged</span>
                <span className="text-stone-800 font-bold">{user?.lastCycleDate ? new Date(user.lastCycleDate).toLocaleDateString() : "Never"}</span>
              </div>
              <div className="flex justify-between text-xs font-medium">
                <span className="text-stone-500">Consistency Score</span>
                <span className="text-emerald-600 font-bold">{coverageScore}%</span>
              </div>
              <div className="flex justify-between text-xs font-medium">
                <span className="text-stone-500">Account Status</span>
                <span className={clsx("font-extrabold uppercase text-[10px] px-1.5 py-0.5 rounded", user?.is_active ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800")}>
                   {user?.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
            <div className="pt-2">
              <button
                onClick={doResetPassword}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-700 py-3 text-xs font-bold transition-all"
              >
                <KeyRound size={14} />
                Reset User Password
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="flex p-1.5 bg-white/50 border border-white/40 backdrop-blur-md rounded-2xl w-fit shadow-sm overflow-x-auto">
            {(["summary", "logs", "periods"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={clsx(
                  "px-6 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                  tab === t ? "text-white shadow-md shadow-rose-200" : "text-stone-500 hover:bg-stone-100"
                )}
                style={tab === t ? { background: "linear-gradient(135deg, var(--admin-accent), var(--admin-accent-dark))" } : undefined}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <div className="rounded-3xl border border-white/40 bg-white/70 backdrop-blur-xl shadow-xl shadow-stone-200/50 overflow-hidden min-h-[400px]">
            {tab === "summary" && (
              <div className="p-8 space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="p-6 rounded-2xl bg-stone-50 border border-stone-100">
                    <div className="text-xs font-bold text-stone-500 uppercase mb-4">Recent Pain Trend</div>
                    <UserPainTrendChart logs={logs} />
                  </div>
                  <div className="p-6 rounded-2xl bg-white border border-stone-100 flex flex-col justify-center">
                    <div className="text-xs font-bold text-stone-400 uppercase mb-1">Log Coverage</div>
                    <div className="text-3xl font-extrabold text-stone-800">{coverageScore}%</div>
                    <div className="w-full bg-stone-100 h-1.5 rounded-full mt-3">
                      <div className="h-full rounded-full" style={{ width: `${coverageScore}%`, background: "linear-gradient(90deg, var(--admin-accent), var(--admin-accent-dark))" }} />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="text-sm font-bold text-stone-800">Data Logs Summary</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                     <div className="p-4 rounded-2xl border border-stone-100 bg-white/50">
                        <div className="text-[10px] font-bold text-stone-400 uppercase">First Activity</div>
                        <div className="text-xs font-bold text-stone-700 mt-1">{firstActivityDate ? formatDate(firstActivityDate) : "No logs yet"}</div>
                     </div>
                     <div className="p-4 rounded-2xl border border-stone-100 bg-white/50">
                        <div className="text-[10px] font-bold text-stone-400 uppercase">Avg Mood</div>
                        <div className="text-xs font-bold text-stone-700 mt-1 capitalize">{commonMood}</div>
                     </div>
                     <div className="p-4 rounded-2xl border border-stone-100 bg-white/50">
                        <div className="text-[10px] font-bold text-stone-400 uppercase">Pain Freq</div>
                        <div className="text-xs font-bold text-stone-700 mt-1">Average {averagePain}/10</div>
                     </div>
                  </div>
                </div>
              </div>
            )}

            {tab === "logs" && (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-stone-50/80 border-b border-stone-100 text-stone-500 uppercase tracking-wider text-[10px] font-bold">
                    <tr>
                      <th className="text-left px-8 py-5">Date</th>
                      <th className="text-left px-8 py-5">Mood</th>
                      <th className="text-left px-8 py-5">Pain</th>
                      <th className="text-left px-8 py-5">Symptoms</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100/80">
                    {!logs ? (
                       <tr><td colSpan={4} className="px-8 py-12 text-center text-stone-400 italic">Fetching activity...</td></tr>
                    ) : logs.length === 0 ? (
                       <tr><td colSpan={4} className="px-8 py-12 text-center text-stone-400 italic">No logs found.</td></tr>
                    ) : logs.map((l, i) => (
                       <tr key={i} className="hover:bg-rose-50/30">
                          <td className="px-8 py-5 font-bold text-stone-800">{l.date}</td>
                          <td className="px-8 py-5 text-stone-600 capitalize">{l.mood || "—"}</td>
                          <td className="px-8 py-5 text-stone-600">{l.pain !== null ? `${l.pain}/10` : "—"}</td>
                          <td className="px-8 py-5 flex flex-wrap gap-1">
                             {l.symptoms?.length > 0 ? l.symptoms.map((s: string) => (
                               <span key={s} className="bg-stone-100 text-[#c24a72] px-2 py-0.5 rounded-lg text-xs font-semibold">{s}</span>
                             )) : "—"}
                          </td>
                       </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === "periods" && (
              <div className="p-8">
                 <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {!dates ? (
                       <div className="col-span-full py-20 text-center text-stone-400 italic">Loading period data...</div>
                    ) : dates.length === 0 ? (
                       <div className="col-span-full py-20 text-center text-stone-400 italic">No period dates marked.</div>
                    ) : dates.map((d, i) => (
                       <div key={i} className="p-4 rounded-2xl bg-white border border-stone-100 text-center shadow-sm">
                          <div className="text-[10px] font-bold text-stone-400 uppercase mb-1">Marked Date</div>
                          <div className="text-sm font-bold text-[#c24a72]">{d}</div>
                       </div>
                    ))}
                 </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SystemView() {
  const [db, setDb] = useState<any>(null);
  const [ai, setAi] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const [dbStatus, aiStatus] = await Promise.all([getDbStatus(), getAiStatus()]);
        if (!mounted) return;
        setDb(dbStatus);
        setAi(aiStatus);
      } finally {
        if (mounted) setLoading(false);
      }
    })().catch(() => null);
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
        <div className="text-2xl font-extrabold text-[var(--admin-accent-dark)] tracking-tight">System Health</div>
          <p className="text-sm text-stone-500 font-medium">Global infrastructure and deployment status</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="rounded-3xl border border-white/40 bg-white/70 backdrop-blur-xl shadow-xl shadow-stone-200/50 p-8">
           <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                 <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <Server size={24} />
                 </div>
                 <div>
                    <div className="text-sm font-bold text-stone-800 tracking-tight">Database Infrastructure</div>
                    <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Active & Connected</div>
                 </div>
              </div>
              <div className="flex flex-col items-end">
                 <div className="text-xs font-bold text-stone-400">Provider</div>
                 <div className="text-sm font-extrabold text-[#c24a72] capitalize">{db?.provider || "..."}</div>
              </div>
           </div>

           <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-100">
                 <div className="text-[10px] font-bold text-stone-400 uppercase">Users</div>
                 <div className="text-lg font-extrabold text-stone-800">{db?.users ?? 0}</div>
              </div>
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-100">
                 <div className="text-[10px] font-bold text-stone-400 uppercase">Total Logs</div>
                 <div className="text-lg font-extrabold text-stone-800">{db?.logs ?? 0}</div>
              </div>
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-100">
                 <div className="text-[10px] font-bold text-stone-400 uppercase">Storage</div>
                 <div className="text-lg font-extrabold text-stone-800">OK</div>
              </div>
           </div>
        </div>

        <div className="rounded-3xl border border-white/40 bg-white/70 backdrop-blur-xl shadow-xl shadow-stone-200/50 p-8">
           <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                 <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-[#c24a72]">
                    <Shield size={24} />
                 </div>
                 <div>
                    <div className="text-sm font-bold text-stone-800 tracking-tight">AI Services</div>
                    <div className="text-[10px] font-bold text-[#c24a72] uppercase tracking-widest">Operational</div>
                 </div>
              </div>
              <div className="flex flex-col items-end">
                 <div className="text-xs font-bold text-stone-400">Model</div>
                 <div className="text-sm font-extrabold text-[#c24a72]">Gemini 2.5</div>
              </div>
           </div>

           <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-stone-50 border border-stone-100">
                 <div className="text-xs font-bold text-stone-600">API Key Status</div>
                 <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-extrabold text-emerald-600 uppercase">Verified</span>
                 </div>
              </div>
              <div className="flex items-center justify-between p-4 rounded-2xl bg-stone-50 border border-stone-100">
                 <div className="text-xs font-bold text-stone-600">Response Latency</div>
                 <div className="text-xs font-extrabold text-stone-800">~1.2s</div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}




function AiMonitoringView() {
  const [aiReport, setAiReport] = useState<any>(null);
  const [comparisonData, setComparisonData] = useState<any[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const loadAi = async (showLoader: boolean) => {
      if (showLoader) setLoading(true);
      try {
        const [reportRes, comparisonRes, statusRes] = await Promise.all([
          adminGetAiAccuracyReport(),
          adminGetAiComparisonData(),
          getAiStatus(),
        ]);
        if (!mounted) return;
        setAiReport(reportRes.report);
        setComparisonData(comparisonRes.data);
        setStatus(statusRes);
      } finally {
        if (mounted && showLoader) setLoading(false);
      }
    };
    loadAi(true).catch(() => null);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") loadAi(false).catch(() => null);
    }, 15000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const tableRows = comparisonData.map((item, index) => ({
    id: index + 1,
    predictedDate: item.prediction_date,
    actualDate: item.actual_date,
    accuracy: calculatePredictionAccuracy(item.accuracy_offset),
  }));

  if (loading) return <div className="p-8 text-center text-stone-500">Loading AI predictions monitoring...</div>;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-extrabold text-[var(--admin-accent-dark)] tracking-tight">AI Predictions Monitoring</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card title="Total Predictions" value={(aiReport?.total ?? 0).toLocaleString()} icon={<Sparkles size={20} />} trend="Validated" />
        <Card title="Accuracy Percentage" value={`${aiReport?.accuracy ?? 0}%`} icon={<Activity size={20} />} trend="Overall" />
        <Card title="Error Count" value={(aiReport?.mismatches ?? 0).toLocaleString()} icon={<X size={20} />} trend="Mismatches" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-8 rounded-3xl border border-white/40 bg-white/70 backdrop-blur-xl p-8 shadow-xl shadow-slate-200/50">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-lg font-extrabold text-stone-800">Accuracy Over Time</div>
              <div className="text-sm text-stone-500 mt-1">Prediction validation accuracy based on predicted and actual cycle dates</div>
            </div>
            <span className="text-xs font-bold text-stone-400">Time series</span>
          </div>
          <PredictionAccuracyChart data={tableRows} />
        </div>

        <div className="xl:col-span-4 rounded-3xl border border-white/40 bg-white/70 backdrop-blur-xl p-8 shadow-xl shadow-slate-200/50">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-lg font-extrabold text-stone-800">Model Information</div>
              <div className="text-sm text-stone-500 mt-1">Deployment and training metadata for the active model</div>
            </div>
            <span className={clsx("text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg", status?.hasKey ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
              {status?.hasKey ? "Active" : "Offline"}
            </span>
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl bg-stone-50 border border-stone-100 p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Model Version</div>
              <div className="mt-2 text-lg font-extrabold text-stone-800">{status?.model || 'Unknown'}</div>
            </div>
            <div className="rounded-2xl bg-stone-50 border border-stone-100 p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Last Training Date</div>
              <div className="mt-2 text-lg font-extrabold text-stone-800">{formatDateTime(aiReport?.lastUpdate)}</div>
            </div>
            <div className="rounded-2xl bg-stone-50 border border-stone-100 p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Status</div>
              <div className="mt-2 text-lg font-extrabold text-stone-800">{status?.hasKey ? 'Operational' : 'Unavailable'}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/40 bg-white/70 backdrop-blur-xl shadow-xl shadow-slate-200/50 overflow-hidden">
        <div className="px-6 py-5 border-b border-stone-100">
          <h3 className="text-lg font-extrabold text-stone-800">Prediction Table</h3>
          <p className="text-sm text-stone-500 mt-1">Predicted dates versus actual dates with per-record accuracy scores.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 uppercase tracking-wider text-[10px] font-black">
              <tr>
                <th className="text-left px-6 py-4">Prediction ID</th>
                <th className="text-left px-6 py-4">Predicted Date</th>
                <th className="text-left px-6 py-4">Actual Date</th>
                <th className="text-left px-6 py-4">Accuracy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tableRows.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-stone-400">No prediction validation data available yet.</td></tr>
              ) : tableRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-stone-500">#{row.id}</td>
                  <td className="px-6 py-4 text-stone-700 font-medium">{formatDate(row.predictedDate)}</td>
                  <td className="px-6 py-4 text-stone-700 font-medium">{formatDate(row.actualDate)}</td>
                  <td className="px-6 py-4">
                    <span className={clsx("rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest", row.accuracy >= 80 ? "bg-emerald-100 text-emerald-700" : row.accuracy >= 60 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700")}>
                      {row.accuracy}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CycleMonitoringView() {
  const [summary, setSummary] = useState<any>(null);
  const [cycles, setCycles] = useState<any[]>([]);
  const [totalCycles, setTotalCycles] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);
  const [page, setPage] = useState(0);
  const limit = 10;

  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    minLength: "",
    maxLength: "",
  });

  const loadSummary = async () => {
    try {
      const res = await adminGetCycleSummary();
      setSummary(res.summary);
    } catch (e) {
      console.error(e);
    }
  };

  const loadCycles = async () => {
    setFilterLoading(true);
    try {
      const res = await adminListAnonymizedCycles({
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        minLength: filters.minLength ? Number(filters.minLength) : undefined,
        maxLength: filters.maxLength ? Number(filters.maxLength) : undefined,
        limit,
        offset: page * limit,
      });
      setCycles(res.cycles);
      setTotalCycles(res.total);
    } finally {
      setFilterLoading(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary().catch(() => null);
  }, []);

  useEffect(() => {
    loadCycles().catch(() => null);
  }, [page, filters]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        loadSummary().catch(() => null);
        loadCycles().catch(() => null);
      }
    }, 15000);
    return () => window.clearInterval(timer);
  }, [page, filters]);

  if (loading) return <div className="p-8 text-center text-stone-500">Loading cycle monitoring...</div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[var(--admin-accent-dark)] tracking-tight">Cycle Data Monitoring</h2>
        </div>
        <button
          onClick={() => adminExportData("cycles")}
          className="inline-flex items-center gap-2 rounded-2xl bg-white border border-stone-200 px-5 py-3 text-sm font-bold text-stone-700 hover:text-[#c24a72] transition-all shadow-sm group"
        >
          <Download size={18} className="group-hover:translate-y-0.5 transition-transform" />
          <span>Export Anonymized CSV</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card title="Average Cycle Length" value={`${summary?.avgCycleLength || '?'} Days`} icon={<Activity size={20} />} trend="Anonymized" />
        <Card title="Average Period Duration" value={`${summary?.avgPeriodDuration || '?'} Days`} icon={<PieChart size={20} />} trend="Anonymized" />
        <Card title="Irregular Cycles" value={`${summary?.irregularPercentage || 0}%`} icon={<Sparkles size={20} />} trend="Platform Wide" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="rounded-3xl border border-white/40 bg-white/70 backdrop-blur-xl p-8 shadow-xl shadow-slate-200/50">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-lg font-extrabold text-stone-800">Most Common Symptoms</div>
              <div className="text-sm text-stone-500 mt-1">Most frequently reported anonymized symptoms across records</div>
            </div>
            <span className="text-xs font-bold text-stone-400">Top trends</span>
          </div>
          <div className="space-y-4">
            {summary?.symptoms?.length ? summary.symptoms.map((s: any, i: number) => (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm font-bold text-stone-700">
                  <span>{s.name}</span>
                  <span className="text-stone-400">{s.count}</span>
                </div>
                <div className="h-2.5 rounded-full bg-stone-100 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#c24a72] to-rose-300" style={{ width: `${Math.min(100, ((s.count || 0) / Math.max(summary.totalRecords || 1, 1)) * 100)}%` }} />
                </div>
              </div>
            )) : <div className="text-sm text-stone-400 italic">No symptom data available yet.</div>}
          </div>
        </div>

        <div className="rounded-3xl border border-white/40 bg-white/70 backdrop-blur-xl p-8 shadow-xl shadow-slate-200/50">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-lg font-extrabold text-stone-800">Cycle Length Distribution</div>
              <div className="text-sm text-stone-500 mt-1">Distribution of short, normal, and long cycles</div>
            </div>
            <span className="text-xs font-bold text-stone-400">Short / Normal / Long</span>
          </div>
          <DistributionPieChart distribution={summary?.distribution} />
        </div>
      </div>

      <div className="rounded-3xl border border-white/40 bg-white/70 backdrop-blur-xl shadow-xl shadow-slate-200/50 overflow-hidden relative">
        {filterLoading && <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-10 flex items-center justify-center font-bold text-[#c24a72]">Refreshing...</div>}
        <div className="px-6 py-5 border-b border-stone-100 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-extrabold text-stone-800">Cycle Data Table</h3>
            <p className="text-sm text-stone-500 mt-1">Anonymized cycle records with no user identity shown.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full xl:w-auto">
            <input type="date" value={filters.dateFrom} onChange={(e) => { setPage(0); setFilters((f) => ({ ...f, dateFrom: e.target.value })); }} className="rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 outline-none focus:border-[#c24a72]" />
            <input type="date" value={filters.dateTo} onChange={(e) => { setPage(0); setFilters((f) => ({ ...f, dateTo: e.target.value })); }} className="rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 outline-none focus:border-[#c24a72]" />
            <input type="number" min="0" placeholder="Min cycle" value={filters.minLength} onChange={(e) => { setPage(0); setFilters((f) => ({ ...f, minLength: e.target.value })); }} className="rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 outline-none focus:border-[#c24a72]" />
            <input type="number" min="0" placeholder="Max cycle" value={filters.maxLength} onChange={(e) => { setPage(0); setFilters((f) => ({ ...f, maxLength: e.target.value })); }} className="rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 outline-none focus:border-[#c24a72]" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 uppercase tracking-wider text-[10px] font-black">
              <tr>
                <th className="text-left px-6 py-4">Record ID</th>
                <th className="text-left px-6 py-4">Cycle Length</th>
                <th className="text-left px-6 py-4">Period Duration</th>
                <th className="text-left px-6 py-4">Symptoms</th>
                <th className="text-left px-6 py-4">Date Logged</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cycles.map((c: any) => (
                <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-stone-500">#{c.id}</td>
                  <td className="px-6 py-4"><span className="font-extrabold text-stone-800">{c.cycleLength}</span><span className="text-xs text-stone-400 ml-1">days</span></td>
                  <td className="px-6 py-4"><span className="font-extrabold text-stone-800">{c.periodDuration}</span><span className="text-xs text-stone-400 ml-1">days</span></td>
                  <td className="px-6 py-4 text-stone-600">{formatCycleSymptoms(c.symptoms)}</td>
                  <td className="px-6 py-4 text-stone-500 font-medium">{formatDate(c.dateLogged)}</td>
                </tr>
              ))}
              {cycles.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-stone-400">No anonymized cycle records found for the selected filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalCycles > limit && (
          <div className="bg-slate-50/50 border-t border-slate-100 px-6 py-4 flex items-center justify-between">
            <div className="text-xs font-bold text-stone-400">
              Showing {totalCycles === 0 ? 0 : page * limit + 1} - {Math.min((page + 1) * limit, totalCycles)} of {totalCycles}
            </div>
            <div className="flex gap-2">
              <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="px-4 py-2 rounded-xl bg-white border border-stone-200 text-xs font-bold text-stone-600 disabled:opacity-50">Previous</button>
              <button disabled={(page + 1) * limit >= totalCycles} onClick={() => setPage((p) => p + 1)} className="px-4 py-2 rounded-xl bg-white border border-stone-200 text-xs font-bold text-stone-600 disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AnalyticsView() {
  const [dailyStats, setDailyStats] = useState<any[]>([]);
  const [userStats, setUserStats] = useState<any>(null);
  const [cycleSummary, setCycleSummary] = useState<any>(null);
  const [cycles, setCycles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const loadAnalytics = async (showLoader: boolean) => {
      if (showLoader) setLoading(true);
      try {
        const [dailyRes, userRes, cycleRes, cycleListRes] = await Promise.all([
          adminGetDailyStats(),
          adminGetUsersStats(),
          adminGetCycleSummary(),
          adminListAnonymizedCycles({ limit: 240, offset: 0 }),
        ]);
        if (!mounted) return;
        setDailyStats(dailyRes.stats);
        setUserStats(userRes.stats);
        setCycleSummary(cycleRes.summary);
        setCycles(cycleListRes.cycles);
      } finally {
        if (mounted && showLoader) setLoading(false);
      }
    };
    loadAnalytics(true).catch(() => null);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") loadAnalytics(false).catch(() => null);
    }, 15000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  if (loading) return <div className="p-8 text-center text-stone-500">Loading analytics and reports...</div>;

  const monthlyGrowth = buildMonthlyGrowth(dailyStats);
  const cycleLengthTrend = buildCycleTrend(cycles, 'cycleLength');
  const periodDurationTrend = buildCycleTrend(cycles, 'periodDuration');

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[var(--admin-accent-dark)] tracking-tight">Analytics and Reports</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => adminExportData('users')} className="inline-flex items-center gap-2 rounded-2xl bg-white border border-stone-200 px-4 py-2.5 text-sm font-bold text-stone-700 hover:text-[#c24a72] transition-all shadow-sm"><Download size={16} /> Users CSV</button>
          <button onClick={() => adminExportData('daily')} className="inline-flex items-center gap-2 rounded-2xl bg-white border border-stone-200 px-4 py-2.5 text-sm font-bold text-stone-700 hover:text-[#c24a72] transition-all shadow-sm"><Download size={16} /> Daily CSV</button>
          <button onClick={() => adminExportData('cycles')} className="inline-flex items-center gap-2 rounded-2xl bg-white border border-stone-200 px-4 py-2.5 text-sm font-bold text-stone-700 hover:text-[#c24a72] transition-all shadow-sm"><Download size={16} /> Cycles CSV</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card title="Monthly User Growth" value={`${monthlyGrowth.at(-1)?.value ?? 0}`} icon={<Users size={20} />} trend="Latest month" />
        <Card title="Active Users" value={userStats?.active_today ?? 0} icon={<Activity size={20} />} trend="Today" />
        <Card title="Average Cycle" value={`${cycleSummary?.avgCycleLength ?? '?'} Days`} icon={<PieChart size={20} />} trend="Platform average" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-7 rounded-3xl border border-white/40 bg-white/70 backdrop-blur-xl p-8 shadow-xl shadow-slate-200/50">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-lg font-extrabold text-stone-800">User Analytics</div>
              <div className="text-sm text-stone-500 mt-1">Monthly user growth and active users snapshot</div>
            </div>
            <span className="text-xs font-bold text-stone-400">Growth</span>
          </div>
          <MonthlyGrowthChart data={monthlyGrowth} />
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-stone-50 border border-stone-100 p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Active Users</div>
              <div className="mt-2 text-2xl font-extrabold text-stone-800">{userStats?.active_today ?? 0}</div>
            </div>
            <div className="rounded-2xl bg-stone-50 border border-stone-100 p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">New This Month</div>
              <div className="mt-2 text-2xl font-extrabold text-stone-800">{userStats?.new_this_month ?? 0}</div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-5 rounded-3xl border border-white/40 bg-white/70 backdrop-blur-xl p-8 shadow-xl shadow-slate-200/50">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-lg font-extrabold text-stone-800">Symptom Analytics</div>
              <div className="text-sm text-stone-500 mt-1">Most common symptoms reported across anonymized cycle records</div>
            </div>
            <span className="text-xs font-bold text-stone-400">Symptoms</span>
          </div>
          <div className="space-y-4">
            {cycleSummary?.symptoms?.length ? cycleSummary.symptoms.map((symptom: any) => (
              <div key={symptom.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm font-bold text-stone-700">
                  <span>{symptom.name}</span>
                  <span className="text-stone-400">{symptom.count}</span>
                </div>
                <div className="h-2.5 rounded-full bg-stone-100 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#c24a72] to-rose-300" style={{ width: `${Math.min(100, ((symptom.count || 0) / Math.max(cycleSummary.totalRecords || 1, 1)) * 100)}%` }} />
                </div>
              </div>
            )) : <div className="text-sm text-stone-400 italic">No symptom analytics available.</div>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="rounded-3xl border border-white/40 bg-white/70 backdrop-blur-xl p-8 shadow-xl shadow-slate-200/50">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-lg font-extrabold text-stone-800">Average Cycle Trend</div>
              <div className="text-sm text-stone-500 mt-1">Average cycle length over time from anonymized records</div>
            </div>
            <span className="text-xs font-bold text-stone-400">Trend</span>
          </div>
          <MetricTrendChart data={cycleLengthTrend} metricLabel="Cycle Length" suffix="d" />
        </div>

        <div className="rounded-3xl border border-white/40 bg-white/70 backdrop-blur-xl p-8 shadow-xl shadow-slate-200/50">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-lg font-extrabold text-stone-800">Period Duration Trend</div>
              <div className="text-sm text-stone-500 mt-1">Average period duration over time from anonymized records</div>
            </div>
            <span className="text-xs font-bold text-stone-400">Trend</span>
          </div>
          <MetricTrendChart data={periodDurationTrend} metricLabel="Period Duration" suffix="d" />
        </div>
      </div>
    </div>
  );
}

function buildCycleTrend(cycles: any[], key: 'cycleLength' | 'periodDuration') {
  const monthMap = new Map<string, { label: string; value: number; fullLabel: string; count: number }>();

  cycles.forEach((item) => {
    const date = new Date(item.dateLogged);
    if (Number.isNaN(date.getTime())) return;
    const mapKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const current = monthMap.get(mapKey) || {
      label: date.toLocaleDateString('en-US', { month: 'short' }),
      fullLabel: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      value: 0,
      count: 0,
    };
    current.value += Number(item[key] || 0);
    current.count += 1;
    monthMap.set(mapKey, current);
  });

  return Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([, item]) => ({
      label: item.label,
      fullLabel: item.fullLabel,
      value: Number((item.value / Math.max(item.count, 1)).toFixed(1)),
    }));
}

function MetricTrendChart({ data, metricLabel, suffix = '' }: { data: Array<{ label: string; fullLabel: string; value: number }>; metricLabel: string; suffix?: string }) {
  if (!data.length) return <div className="h-56 flex items-center justify-center text-stone-400 font-medium">No trend data available yet.</div>;

  const max = Math.max(...data.map((item) => item.value), 1);
  const width = 640;
  const height = 220;
  const paddingX = 34;
  const paddingY = 26;
  const points = data.map((item, index) => {
    const x = data.length === 1 ? width / 2 : paddingX + (index * (width - paddingX * 2)) / (data.length - 1);
    const y = height - paddingY - (item.value * (height - paddingY * 2)) / max;
    return { ...item, x, y };
  });

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        {[0, 0.25, 0.5, 0.75, 1].map((step) => {
          const y = height - paddingY - step * (height - paddingY * 2);
          return <line key={step} x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="#e7e5e4" strokeDasharray="4 4" />;
        })}
        <polyline fill="none" stroke="#c24a72" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={points.map((point) => `${point.x},${point.y}`).join(' ')} />
        {points.map((point) => (
          <g key={point.fullLabel}>
            <circle cx={point.x} cy={point.y} r="5" fill="#fff" stroke="#c24a72" strokeWidth="3" />
            <title>{`${point.fullLabel}: ${point.value}${suffix}`}</title>
          </g>
        ))}
      </svg>
      <div className="mt-4 grid grid-cols-3 sm:grid-cols-6 gap-2">
        {data.map((item) => (
          <div key={item.fullLabel} className="rounded-2xl bg-stone-50 border border-stone-100 px-3 py-2 text-center">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">{item.label}</div>
            <div className="mt-1 text-sm font-bold text-stone-800">{item.value}{suffix}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function calculatePredictionAccuracy(offset: number | null | undefined) {
  const delta = Math.abs(Number(offset || 0));
  return Math.max(0, Math.round(100 - delta * 20));
}

function PredictionAccuracyChart({ data }: { data: Array<{ id: number; predictedDate: string; actualDate: string; accuracy: number }> }) {
  if (!data.length) return <div className="h-56 flex items-center justify-center text-stone-400 font-medium">No accuracy trend data available yet.</div>;

  const width = 760;
  const height = 240;
  const paddingX = 40;
  const paddingY = 28;
  const max = 100;
  const points = data.map((item, index) => {
    const x = data.length === 1 ? width / 2 : paddingX + (index * (width - paddingX * 2)) / (data.length - 1);
    const y = height - paddingY - (item.accuracy * (height - paddingY * 2)) / max;
    return { ...item, x, y };
  });

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = height - paddingY - (tick * (height - paddingY * 2)) / max;
          return <line key={tick} x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="#e7e5e4" strokeDasharray="4 4" />;
        })}
        <polyline fill="none" stroke="#c24a72" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={points.map((point) => `${point.x},${point.y}`).join(' ')} />
        {points.map((point) => (
          <g key={point.id}>
            <circle cx={point.x} cy={point.y} r="5" fill="#fff" stroke="#c24a72" strokeWidth="3" />
            <title>{`Prediction #${point.id}: ${point.accuracy}%`}</title>
          </g>
        ))}
      </svg>
      <div className="mt-4 grid grid-cols-3 sm:grid-cols-6 gap-2">
        {points.slice(-6).map((point) => (
          <div key={point.id} className="rounded-2xl bg-stone-50 border border-stone-100 px-3 py-2 text-center">
            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">#{point.id}</div>
            <div className="mt-1 text-sm font-bold text-stone-800">{point.accuracy}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatCycleSymptoms(value: unknown) {
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'Anonymized';
  if (typeof value === 'string' && value.trim()) return value;
  return 'Anonymized';
}

function FeedbackView() {
  const [feedback, setFeedback] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "resolved" | "unresolved">("all");

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminListFeedback();
      setFeedback(res.feedback);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resolve = async (id: number) => {
    await adminResolveFeedback(id);
    load();
  };

  const remove = async (id: number) => {
    const ok = window.confirm("Delete this feedback entry?");
    if (!ok) return;
    await adminDeleteFeedback(id);
    load();
  };

  const filteredFeedback = feedback.filter((item) => {
    if (statusFilter === "resolved") return Boolean(item.is_resolved);
    if (statusFilter === "unresolved") return !item.is_resolved;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[var(--admin-accent-dark)] tracking-tight">User Feedback</h2>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | "resolved" | "unresolved")}
          className="rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-bold text-stone-700 outline-none focus:border-[#c24a72]"
        >
          <option value="all">All Feedback</option>
          <option value="unresolved">Unresolved</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      <div className="rounded-3xl border border-white/40 bg-white/70 backdrop-blur-xl shadow-xl shadow-slate-200/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 uppercase tracking-wider text-[10px] font-black">
              <tr>
                <th className="text-left px-6 py-4">Feedback ID</th>
                <th className="text-left px-6 py-4">Message</th>
                <th className="text-left px-6 py-4">Date</th>
                <th className="text-left px-6 py-4">Status</th>
                <th className="text-right px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-stone-400">Loading feedback...</td></tr>
              ) : filteredFeedback.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-stone-400">No feedback found for this filter.</td></tr>
              ) : filteredFeedback.map((f: any) => (
                <tr key={f.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-stone-500">#{f.id}</td>
                  <td className="px-6 py-4 text-stone-600 max-w-xl">{f.message}</td>
                  <td className="px-6 py-4 text-stone-500 font-medium">{formatDate(f.created_at)}</td>
                  <td className="px-6 py-4">
                    <span className={clsx("px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest", f.is_resolved ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                      {f.is_resolved ? "Resolved" : "Unresolved"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!f.is_resolved && <button onClick={() => resolve(f.id)} className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition-all">Mark as Resolved</button>}
                      <button onClick={() => remove(f.id)} className="rounded-xl bg-rose-50 border border-rose-100 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-100 transition-all">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ContentView({ currentAdmin }: { currentAdmin: AdminUser }) {
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const categories = ["Menstrual Health", "Lifestyle Tips", "Nutrition", "Wellness"];

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminListArticles();
      setArticles(res.articles);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await adminSaveArticle({
      id: editing?.id,
      title: String(fd.get("title") || ""),
      category: String(fd.get("category") || "Menstrual Health"),
      content: String(fd.get("content") || ""),
      is_published: fd.get("is_published") === "on",
    });
    setShowEdit(false);
    setEditing(null);
    load();
  };

  const remove = async (id: number) => {
    const ok = window.confirm("Delete this article?");
    if (!ok) return;
    await adminDeleteArticle(id);
    load();
  };

  const togglePublish = async (article: any) => {
    await adminSaveArticle({
      id: article.id,
      title: article.title,
      category: article.category || "Menstrual Health",
      content: article.content,
      is_published: !article.is_published,
    });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-stone-800 tracking-tight">Content Management</h2>
        </div>
        <button onClick={() => { setEditing(null); setShowEdit(true); }} className="px-4 py-2.5 bg-rose-500 text-white rounded-2xl font-bold text-sm shadow-md hover:bg-rose-600 transition-colors flex items-center gap-2">
          <Plus size={16} /> Add Article
        </button>
      </div>

      {showEdit && (
        <div className="rounded-3xl border border-rose-100 bg-white p-6 shadow-xl">
          <div className="mb-5">
            <h3 className="text-lg font-extrabold text-stone-800">{editing ? 'Edit Article' : 'Add Article'}</h3>
            <p className="text-sm text-stone-500 mt-1">Create or update article title, category, content, and publish status.</p>
          </div>
          <form onSubmit={save} className="space-y-4">
            <input name="title" placeholder="Article Title" defaultValue={editing?.title} className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm font-bold outline-none focus:border-[#c24a72]" required />
            <select name="category" defaultValue={editing?.category || 'Menstrual Health'} className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm font-bold outline-none focus:border-[#c24a72]">
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            <textarea name="content" placeholder="Write the article content..." defaultValue={editing?.content} className="w-full h-56 rounded-2xl border border-stone-200 p-4 text-sm outline-none focus:border-[#c24a72]" required />
            <label className="inline-flex items-center gap-2 text-sm font-bold text-stone-600">
              <input type="checkbox" name="is_published" defaultChecked={editing ? editing.is_published !== 0 : true} />
              Publish immediately
            </label>
            <div className="flex justify-end gap-3">
               <button type="button" onClick={() => { setShowEdit(false); setEditing(null); }} className="px-4 py-2 text-sm font-bold text-stone-500">Cancel</button>
               <button type="submit" className="px-6 py-2.5 bg-stone-900 text-white rounded-2xl font-bold text-sm">Save</button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-3xl border border-white/40 bg-white/70 backdrop-blur-xl shadow-xl shadow-slate-200/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 uppercase tracking-wider text-[10px] font-black">
              <tr>
                <th className="text-left px-6 py-4">Title</th>
                <th className="text-left px-6 py-4">Category</th>
                <th className="text-left px-6 py-4">Status</th>
                <th className="text-left px-6 py-4">Publish Date</th>
                <th className="text-right px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-stone-400">Loading articles...</td></tr>
              ) : articles.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-stone-400">No articles created yet.</td></tr>
              ) : articles.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-stone-800">{a.title}</div>
                    <div className="text-xs text-stone-400 mt-1">By {a.author_name || currentAdmin.name}</div>
                  </td>
                  <td className="px-6 py-4 text-stone-600 font-medium">{a.category || 'Menstrual Health'}</td>
                  <td className="px-6 py-4">
                    <span className={clsx("px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest", a.is_published ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-700")}>
                      {a.is_published ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-stone-500 font-medium">{formatDate(a.created_at)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => { setEditing(a); setShowEdit(true); }} className="rounded-xl border border-stone-200 px-3 py-2 text-xs font-bold text-stone-600 hover:text-[#c24a72] hover:border-rose-200 transition-all">Edit</button>
                      <button onClick={() => togglePublish(a)} className={clsx("rounded-xl px-3 py-2 text-xs font-bold transition-all", a.is_published ? "bg-amber-50 border border-amber-100 text-amber-700 hover:bg-amber-100" : "bg-emerald-50 border border-emerald-100 text-emerald-700 hover:bg-emerald-100")}>
                        {a.is_published ? 'Unpublish' : 'Publish'}
                      </button>
                      <button onClick={() => remove(a.id)} className="rounded-xl bg-rose-50 border border-rose-100 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-100 transition-all">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function NotificationsView() {
  const [notifs, setNotifs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [notifRes, userRes] = await Promise.all([
        adminListNotifications(),
        adminListUsers({ limit: 200, offset: 0 }),
      ]);
      setNotifs(notifRes.notifications);
      setUsers(userRes.users);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  const actionGradient = { background: "linear-gradient(135deg, var(--admin-accent), var(--admin-accent-dark))" };

  const send = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      type: String(fd.get("type") || "info"),
      title: String(fd.get("title") || ""),
      message: String(fd.get("message") || ""),
      target_group: String(fd.get("target_group") || "all"),
      target_user_id: fd.get("target_group") === "specific" ? Number(fd.get("target_user_id")) : null,
      scheduled_for: String(fd.get("scheduled_for") || "") || null,
    };
    if (editing?.id) await adminUpdateNotification(editing.id, payload);
    else await adminCreateNotification(payload);
    e.currentTarget.reset();
    setEditing(null);
    load();
  };

  const remove = async (id: number) => {
    const ok = window.confirm("Delete this notification?");
    if (!ok) return;
    await adminDeleteNotification(id);
    load();
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-extrabold text-[var(--admin-accent-dark)] tracking-tight">Notification Management</h2>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-4">
          <div className="rounded-[2rem] border p-6 shadow-xl" style={{ borderColor: "var(--admin-accent-border)", background: "linear-gradient(180deg, var(--admin-accent-soft), white)" }}>
            <h3 className="font-extrabold text-[#903b5c] mb-4 tracking-tight">Create Notification</h3>
            <form onSubmit={send} className="space-y-4">
              <input name="title" placeholder="Title" defaultValue={editing?.title || ""} className="w-full rounded-2xl border bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[var(--admin-accent)]" style={{ borderColor: "var(--admin-accent-border)" }} required />
              <textarea name="message" placeholder="Message" defaultValue={editing?.message || ""} className="w-full h-32 rounded-2xl border bg-white px-4 py-3 text-sm outline-none focus:border-[var(--admin-accent)]" style={{ borderColor: "var(--admin-accent-border)" }} required />
              <select name="target_group" defaultValue={editing?.target_group || "all"} className="w-full rounded-2xl border bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[var(--admin-accent)]" style={{ borderColor: "var(--admin-accent-border)" }}>
                <option value="all">All Users</option>
                <option value="active">Active Users</option>
                <option value="inactive">Inactive Users</option>
                <option value="specific">Specific User</option>
              </select>
              <select name="target_user_id" defaultValue={editing?.target_user_id || ""} className="w-full rounded-2xl border bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[var(--admin-accent)]" style={{ borderColor: "var(--admin-accent-border)" }}>
                <option value="">Select specific user</option>
                {users.map((user) => <option key={user.id} value={user.id}>{user.name} ({user.email})</option>)}
              </select>
              <input type="datetime-local" name="scheduled_for" defaultValue={toDateTimeLocal(editing?.scheduled_for)} className="w-full rounded-2xl border bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[var(--admin-accent)]" style={{ borderColor: "var(--admin-accent-border)" }} />
              <select name="type" defaultValue={editing?.type || "info"} className="w-full rounded-2xl border bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[var(--admin-accent)]" style={{ borderColor: "var(--admin-accent-border)" }}>
                <option value="info">Information</option>
                <option value="alert">Alert</option>
                <option value="update">System Update</option>
              </select>
              <div className="flex gap-3">
                {editing && <button type="button" onClick={() => setEditing(null)} className="flex-1 rounded-2xl border border-stone-200 px-4 py-3 text-sm font-bold text-stone-600">Cancel</button>}
                <button className="flex-1 py-3 text-white rounded-2xl font-bold shadow-lg shadow-rose-200" style={actionGradient}>
                  {editing ? 'Edit Scheduled Notification' : 'Send Notification'}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="xl:col-span-8">
          <div className="rounded-[2rem] border border-white/40 bg-white/80 backdrop-blur-xl shadow-xl shadow-rose-100/50 overflow-hidden">
            <div className="px-6 py-5 border-b border-stone-100">
              <h3 className="font-extrabold text-stone-800">Notification History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-rose-50/60 border-b border-rose-100 text-stone-500 uppercase tracking-wider text-[10px] font-black">
                  <tr>
                    <th className="text-left px-6 py-4">Notification ID</th>
                    <th className="text-left px-6 py-4">Title</th>
                    <th className="text-left px-6 py-4">Date Sent</th>
                    <th className="text-right px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {loading ? <tr><td colSpan={4} className="p-8 text-center text-stone-400">Loading notifications...</td></tr> : notifs.map((n) => (
                    <tr key={n.id} className="hover:bg-rose-50/30 transition-colors">
                      <td className="px-6 py-4 font-bold text-stone-500">#{n.id}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-stone-800">{n.title}</div>
                        <div className="text-xs text-stone-400 mt-1">{n.target_group === 'specific' ? 'Specific user' : `${n.target_group} users`}</div>
                      </td>
                      <td className="px-6 py-4 text-stone-500 font-medium">{formatDateTime(n.scheduled_for || n.created_at)}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {n.scheduled_for && <button onClick={() => setEditing(n)} className="rounded-xl border border-stone-200 px-3 py-2 text-xs font-bold text-stone-600 hover:text-[#c24a72] hover:border-rose-200 transition-all">Edit Scheduled Notification</button>}
                          <button onClick={() => remove(n.id)} className="rounded-xl bg-rose-50 border border-rose-100 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-100 transition-all">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!loading && notifs.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-stone-400">No notifications created yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsView({ currentAdmin, onAdminUpdate }: { currentAdmin: AdminUser; onAdminUpdate: (admin: AdminUser) => void }) {
  const getSelectedTheme = () => {
    try {
      return (localStorage.getItem("theme") as "rose" | "teal" | "dark") || "rose";
    } catch {
      return "rose";
    }
  };
  const [email, setEmail] = useState(currentAdmin.email);
  const [emailBusy, setEmailBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [aiSettings, setAiSettings] = useState({ model_version: 'gemini-2.5-flash', prediction_threshold: '0.80', last_training_date: '', theme_accent: 'rose' });
  const [activeTheme, setActiveTheme] = useState<"rose" | "teal" | "dark">(getSelectedTheme);

  useEffect(() => {
    let mounted = true;
    setActiveTheme(getSelectedTheme());
    (async () => {
      const settingsRes = await adminGetAiSettings();
      if (!mounted) return;
      setAiSettings(settingsRes.settings);
      const storedTheme = getSelectedTheme() || (settingsRes.settings.theme_accent as "rose" | "teal" | "dark") || "rose";
      setActiveTheme(storedTheme);
    })().catch(() => null);
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const syncTheme = () => setActiveTheme(getSelectedTheme());
    window.addEventListener("admin-theme-change", syncTheme);
    window.addEventListener("storage", syncTheme);
    return () => {
      window.removeEventListener("admin-theme-change", syncTheme);
      window.removeEventListener("storage", syncTheme);
    };
  }, []);

  const applyTheme = async (theme: "rose" | "teal" | "dark") => {
    setActiveTheme(theme);
    localStorage.setItem("theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
    window.dispatchEvent(new Event("admin-theme-change"));
    const nextSettings = { ...aiSettings, theme_accent: theme };
    setAiSettings(nextSettings);
    void adminSaveAiSettings(nextSettings).catch(() => null);
  };

  const updateEmail = async () => {
    if (!email.trim() || email.trim() === currentAdmin.email) return;
    setEmailBusy(true);
    try {
      const res = await adminUpdateMe({ email: email.trim() });
      setStoredAdmin(res.admin);
      onAdminUpdate(res.admin);
      setEmail(res.admin.email);
      window.alert("Email updated successfully.");
    } catch (err: any) {
      window.alert(err.message || "Failed to update email.");
    } finally {
      setEmailBusy(false);
    }
  };

  const updatePassword = async () => {
    if (!newPassword || !confirmPassword) {
      window.alert("Please fill both password fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      window.alert("Passwords do not match.");
      return;
    }
    setPasswordBusy(true);
    try {
      await adminResetAdminPassword(currentAdmin.id, newPassword);
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordForm(false);
      window.alert("Password updated successfully.");
    } catch (err: any) {
      window.alert(err.message || "Failed to update password.");
    } finally {
      setPasswordBusy(false);
    }
  };

  const saveAi = async () => {
    setAiBusy(true);
    try {
      const res = await adminSaveAiSettings(aiSettings);
      setAiSettings(res.settings);
      window.alert("AI settings updated successfully.");
    } catch (err: any) {
      window.alert(err.message || "Failed to update AI settings.");
    } finally {
      setAiBusy(false);
    }
  };

  const themeOptions: Array<{ key: "rose" | "teal" | "dark"; color: string }> = [
    { key: "rose", color: "bg-[#c24a72]" },
    { key: "teal", color: "bg-[#0d9488]" },
    { key: "dark", color: "bg-[#334155]" },
  ];
  const actionGradient = { background: "linear-gradient(135deg, var(--admin-accent), var(--admin-accent-dark))" };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-extrabold text-[var(--admin-accent-dark)] tracking-tight">Settings</h2>
      </div>

      <div className="grid gap-6">
        <section className="rounded-[2rem] border border-[#f1e4da] bg-gradient-to-b from-white to-[#fffaf7] p-6 shadow-[0_20px_50px_rgba(194,74,114,0.08)]">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div className="text-sm font-bold text-stone-700">Profile</div>
            <button type="button" onClick={updateEmail} disabled={emailBusy || email.trim() === currentAdmin.email} className="text-sm font-bold text-[var(--admin-accent)] disabled:opacity-40">{emailBusy ? 'Saving' : 'Edit'}</button>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="h-14 w-14 rounded-full text-white flex items-center justify-center text-xl font-black uppercase shadow-md" style={{ background: "linear-gradient(135deg, var(--admin-accent), var(--admin-accent-dark))" }}>
              {currentAdmin.name?.slice(0, 1) || 'A'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-lg font-extrabold text-stone-800">{currentAdmin.name}</div>
              <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full max-w-sm rounded-xl border border-transparent bg-transparent px-0 py-0 text-sm text-stone-500 outline-none focus:border-transparent" />
              <div className="mt-3 flex gap-8 text-[11px] uppercase tracking-widest text-stone-400 font-bold">
                <div>
                  <div>Role</div>
                  <div className="mt-1 text-stone-700 text-xs normal-case tracking-normal">{currentAdmin.role}</div>
                </div>
                <div>
                  <div>Joined</div>
                  <div className="mt-1 text-stone-700 text-xs normal-case tracking-normal">{formatDate(currentAdmin.created_at)}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-[#f1e4da] bg-white p-6 shadow-[0_20px_50px_rgba(194,74,114,0.05)]">
          <div className="text-sm font-bold text-stone-700 mb-5">Security</div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-stone-100 bg-[#fffaf7] px-4 py-4">
            <div>
              <div className="text-sm font-bold text-stone-800">Password</div>
              <div className="text-xs text-stone-500 mt-1">Protected account access</div>
            </div>
            <button type="button" onClick={() => setShowPasswordForm((prev) => !prev)} className="rounded-xl px-4 py-2 text-sm font-bold text-[var(--admin-accent)]" style={{ backgroundColor: "var(--admin-accent-soft)" }}>
              {showPasswordForm ? 'Cancel' : 'Change Password'}
            </button>
          </div>
          {showPasswordForm && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none focus:border-[var(--admin-accent)]" autoComplete="new-password" />
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm password" className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none focus:border-[var(--admin-accent)]" autoComplete="new-password" />
              <div className="sm:col-span-2 flex justify-end">
                <button type="button" onClick={updatePassword} disabled={passwordBusy} className="rounded-2xl px-5 py-3 text-sm font-bold text-white disabled:opacity-50" style={actionGradient}>
                  {passwordBusy ? 'Changing' : 'Change Password'}
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-[2rem] border border-[#f1e4da] bg-white p-6 shadow-[0_20px_50px_rgba(194,74,114,0.05)]">
          <div className="text-sm font-bold text-stone-700 mb-5">Theme Color</div>
          <div className="flex gap-4">
            {themeOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => applyTheme(option.key)}
                className={clsx(
                  "h-12 w-12 rounded-full border-4 transition-all",
                  option.color,
                  activeTheme === option.key ? "scale-110 border-white" : "border-white hover:scale-105"
                )}
                style={activeTheme === option.key ? { boxShadow: "0 0 0 4px var(--admin-accent-border)" } : undefined}
                aria-label="Theme option"
              />
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-[#f1e4da] bg-white p-6 shadow-[0_20px_50px_rgba(194,74,114,0.05)]">
          <div className="text-sm font-bold text-stone-700 mb-5">AI Settings</div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5">Model Version</label>
              <input value={aiSettings.model_version} onChange={(e) => setAiSettings((prev) => ({ ...prev, model_version: e.target.value }))} className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none focus:border-[var(--admin-accent)]" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5">Prediction Threshold</label>
              <input value={aiSettings.prediction_threshold} onChange={(e) => setAiSettings((prev) => ({ ...prev, prediction_threshold: e.target.value }))} className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none focus:border-[var(--admin-accent)]" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5">Last Training Date</label>
              <input type="datetime-local" value={toDateTimeLocal(aiSettings.last_training_date)} onChange={(e) => setAiSettings((prev) => ({ ...prev, last_training_date: e.target.value }))} className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none focus:border-[var(--admin-accent)]" />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={saveAi} disabled={aiBusy} className="rounded-2xl px-5 py-3 text-sm font-bold text-white disabled:opacity-50" style={actionGradient}>
              {aiBusy ? 'Saving' : 'Update AI'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function AdminsView({ currentAdmin }: { currentAdmin: AdminUser }) {
  const [q, setQ] = useState("");
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [busyCreate, setBusyCreate] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("manager");

  const load = async (query: string) => {
    setLoading(true);
    try {
      const data = await adminListAdmins({ q: query, limit: 200 });
      setAdmins(data.admins);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load("");
  }, []);

  const doCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) return;
    setBusyCreate(true);
    try {
      await adminCreateAdmin({ name, email, password, role });
      setName("");
      setEmail("");
      setPassword("");
      setRole("manager");
      setShowCreate(false);
      await load(q);
      window.alert("Admin created.");
    } catch (err: any) {
      if (err instanceof AdminApiError) window.alert(err.message);
      else window.alert("Failed to create admin.");
    } finally {
      setBusyCreate(false);
    }
  };

  const doDelete = async (adminUserId: number) => {
    const ok = window.confirm("Delete this admin account? This will also revoke all their sessions.");
    if (!ok) return;
    try {
      await adminDeleteAdmin(adminUserId);
      await load(q);
      window.alert("Admin deleted.");
    } catch (err: any) {
      if (err instanceof AdminApiError) window.alert(err.message);
      else window.alert("Failed to delete admin.");
    }
  };

  const isSuper = String(currentAdmin.role) === "admin";
  const actionGradient = { background: "linear-gradient(135deg, var(--admin-accent), var(--admin-accent-dark))" };

  if (!isSuper) {
    return (
      <div className="rounded-3xl border-2 border-amber-200/50 bg-amber-50 p-6 text-sm text-amber-800 font-medium shadow-sm flex flex-col items-center justify-center text-center py-20">
        <Shield size={48} className="text-amber-300 mb-4" />
        <div className="text-lg font-bold mb-1 border-">Access Restricted</div>
        <div>Admin management is restricted to accounts with the <span className="font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-lg mx-1">admin</span> role.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="text-2xl font-extrabold text-slate-800 tracking-tight">Admins</div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load(q)}
              className="w-full sm:w-80 rounded-2xl border-2 border-stone-100 bg-white/50 px-11 py-2.5 text-sm outline-none transition-all duration-200 focus:border-[#c24a72] focus:bg-white focus:ring-4 focus:ring-[#c24a72]/10 placeholder:text-stone-400 font-medium text-stone-700 shadow-sm"
              placeholder="Search name or email..."
            />
          </div>
          <button onClick={() => load(q)} className="rounded-2xl bg-stone-900 text-white px-5 py-3 text-sm font-bold shadow-md hover:bg-stone-800 transition-colors hidden sm:block">
            Search
          </button>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="inline-flex items-center gap-2 rounded-2xl text-white px-5 py-3 text-sm font-bold hover:shadow-lg hover:shadow-rose-500/30 transition-all hover:-translate-y-0.5"
            style={actionGradient}
          >
            <Plus size={18} className={showCreate ? "rotate-45 transition-transform" : "transition-transform"} />
            New User
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="rounded-3xl border border-rose-100/50 bg-gradient-to-br from-rose-50/50 to-white p-6 shadow-xl shadow-rose-200/50">
          <div className="text-lg font-extrabold text-[var(--admin-accent-dark)] mb-4 tracking-tight">Create New Admin Account</div>
          <form onSubmit={doCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-600 mb-1.5 ml-1 uppercase tracking-wider">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-2xl border-2 border-stone-100 bg-white px-4 py-3 outline-none transition-all duration-200 focus:border-[#c24a72] focus:ring-4 focus:ring-[#c24a72]/10 font-medium text-stone-700"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-600 mb-1.5 ml-1 uppercase tracking-wider">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border-2 border-stone-100 bg-white px-4 py-3 outline-none transition-all duration-200 focus:border-[#c24a72] focus:ring-4 focus:ring-[#c24a72]/10 font-medium text-stone-700"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-600 mb-1.5 ml-1 uppercase tracking-wider">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border-2 border-stone-100 bg-white px-4 py-3 outline-none transition-all duration-200 focus:border-[#c24a72] focus:ring-4 focus:ring-[#c24a72]/10 font-medium text-stone-700"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-600 mb-1.5 ml-1 uppercase tracking-wider">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-2xl border-2 border-stone-100 bg-white px-4 py-3 outline-none transition-all duration-200 focus:border-[#c24a72] focus:ring-4 focus:ring-[#c24a72]/10 font-medium text-stone-700 cursor-pointer"
              >
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="developer">Developer</option>
              </select>
            </div>
            <div className="md:col-span-2 flex items-center justify-end gap-3 pt-3 border-t border-slate-100/80 mt-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-2xl border border-stone-200 bg-white px-5 py-3 text-sm font-bold text-stone-700 hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={busyCreate || !name || !email || !password}
                className="rounded-2xl text-white px-6 py-3 text-sm font-bold shadow-md hover:shadow-rose-500/30 transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                style={actionGradient}
              >
                {busyCreate ? "Creating User..." : "Create Account"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-3xl border border-white/40 bg-white/70 backdrop-blur-xl shadow-xl shadow-slate-200/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 uppercase tracking-wider text-xs">
              <tr>
                <th className="text-left px-6 py-4 font-bold">ID</th>
                <th className="text-left px-6 py-4 font-bold">Name</th>
                <th className="text-left px-6 py-4 font-bold">Email</th>
                <th className="text-left px-6 py-4 font-bold">Role</th>
                <th className="text-left px-6 py-4 font-bold hidden md:table-cell">Created</th>
                <th className="text-left px-6 py-4 font-bold hidden lg:table-cell">Last Login</th>
                <th className="text-right px-6 py-4 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400 font-medium">
                    Loading admin details...
                  </td>
                </tr>
              ) : admins.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400 font-medium bg-slate-50/30">
                    No admins match your search criteria.
                  </td>
                </tr>
              ) : (
                admins.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-slate-500 font-medium">#{a.id}</td>
                    <td className="px-6 py-4 font-bold text-slate-800 flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold shrink-0">
                        {a.name ? a.name.charAt(0).toUpperCase() : "?"}
                      </div>
                      {a.name}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{a.email}</td>
                    <td className="px-6 py-4">
                      <span className={clsx(
                        "px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider",
                        a.role === "admin" ? "bg-amber-100 text-amber-800" :
                        a.role === "developer" ? "bg-emerald-100 text-emerald-800" :
                        "bg-indigo-100 text-indigo-800"
                      )}>
                        {a.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 hidden md:table-cell">{a.created_at?.slice(0, 10) || "—"}</td>
                    <td className="px-6 py-4 text-slate-500 hidden lg:table-cell">{a.last_login_at ? a.last_login_at.slice(0, 10) : "—"}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => doDelete(a.id)}
                          disabled={a.id === currentAdmin.id}
                          className={clsx(
                            "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-bold transition-all shadow-sm",
                            a.id === currentAdmin.id 
                              ? "bg-stone-100 text-stone-400 cursor-not-allowed" 
                              : "bg-rose-50 text-[#c24a72] border border-rose-100 hover:bg-[#c24a72] hover:text-white",
                          )}
                        >
                          <Trash2 size={14} />
                          <span className="hidden sm:inline">Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function AdminApp() {
  const { route } = useAdminRoute();
  const [admin, setAdmin] = useState<AdminUser | null>(() => getStoredAdmin());
  const [authChecked, setAuthChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminTheme, setAdminTheme] = useState<"rose" | "teal" | "dark">(() => {
    try {
      return (localStorage.getItem("theme") as "rose" | "teal" | "dark") || "rose";
    } catch {
      return "rose";
    }
  });

  const isAuthed = Boolean(getAdminToken()) && Boolean(admin);
  const themePalette = getAdminThemePalette(adminTheme);

  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      setAuthChecked(true);
      return;
    }
    (async () => {
      try {
        const data = await adminMe();
        setAdmin(data.admin);
        setStoredAdmin(data.admin);
      } catch (err: any) {
        clearAdminAuth();
        setAdmin(null);
      } finally {
        setAuthChecked(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    if (!isAuthed && (route.name !== "login" && route.name !== "signup")) {
      adminNavigate("/admin/login", true);
    }
    if (isAuthed && (route.name === "login" || route.name === "signup")) {
      adminNavigate("/admin/dashboard", true);
    }
  }, [authChecked, isAuthed, route.name]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [route]);

  useEffect(() => {
    const syncTheme = () => {
      try {
        setAdminTheme((localStorage.getItem("theme") as "rose" | "teal" | "dark") || "rose");
      } catch {
        setAdminTheme("rose");
      }
    };
    window.addEventListener("admin-theme-change", syncTheme);
    window.addEventListener("storage", syncTheme);
    return () => {
      window.removeEventListener("admin-theme-change", syncTheme);
      window.removeEventListener("storage", syncTheme);
    };
  }, []);

  const activeNav = useMemo(() => {
    if (route.name === "users" || route.name === "user") return "users";
    if (route.name === "admins") return "admins";
    if (route.name === "settings") return "settings";
    if (route.name === "cycle") return "cycle";
    if (route.name === "ai") return "ai";
    if (route.name === "analytics") return "analytics";
    if (route.name === "feedback") return "feedback";
    if (route.name === "notifications") return "notifications";
    if (route.name === "profile") return "profile";
    return "dashboard";
  }, [route.name]);

  const onAuthDone = (result: { admin: AdminUser; token: string }) => {
    setAdminToken(result.token);
    setStoredAdmin(result.admin);
    setAdmin(result.admin);
    setError(null);
    adminNavigate("/admin/dashboard", true);
  };

  const doLogout = async () => {
    try {
      await adminLogout();
    } catch {
      // ignore
    }
    clearAdminAuth();
    setAdmin(null);
    adminNavigate("/admin/login", true);
  };

  if (route.name === "login" || route.name === "signup") {
    return (
      <>
        <TopError error={error} onClose={() => setError(null)} />
        <AuthPage mode={route.name} onDone={onAuthDone} onError={setError} />
      </>
    );
  }

  if (!authChecked) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-500">Loading…</div>;
  }

  if (!isAuthed) return null;

  return (
    <div
      className="theme-scope flex h-screen w-full relative overflow-hidden font-sans"
      style={{
        ["--admin-accent" as any]: themePalette.accent,
        ["--admin-accent-dark" as any]: themePalette.accentDark,
        ["--admin-accent-soft" as any]: themePalette.accentSoft,
        ["--admin-accent-border" as any]: themePalette.accentBorder,
        ["--admin-accent-glow" as any]: themePalette.accentGlow,
        backgroundColor: "var(--bg-app)",
      }}
    >
      <div className="absolute top-0 right-0 w-1/3 h-1/3 rounded-bl-full blur-[100px] -z-10 animate-pulse" style={{ animationDuration: '4s', backgroundColor: "var(--admin-accent-soft)" }} />
      <div className="absolute bottom-0 left-0 w-1/2 h-1/3 rounded-tr-[100%] blur-[120px] -z-10 animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s', backgroundColor: "var(--admin-accent-soft)" }} />
      
      {/* Mobile Top Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-xl border-b border-stone-200/60 z-30 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full flex items-center justify-center shadow-md" style={{ backgroundColor: "var(--admin-accent)" }}>
            <DropletLogo className="w-6 h-6 text-[var(--admin-accent-soft)]" innerColor="var(--admin-accent)" />
          </div>
          <div className="text-lg font-extrabold text-[var(--admin-accent-dark)] tracking-tight">Cycle Track AI</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={doLogout}
            className="p-2 rounded-xl bg-red-50 text-red-600 transition-colors"
            aria-label="Logout"
          >
            <LogOut size={20} />
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl bg-stone-50 text-stone-600 hover:text-[var(--admin-accent)] transition-colors"
            aria-label="Open menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Sidebar - Desktop & Mobile Overlay */}
      <div className={clsx(
        "fixed inset-0 z-40 lg:relative lg:z-auto lg:transition-none transition-opacity duration-300",
        mobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none lg:opacity-100 lg:pointer-events-auto"
      )}>
        {/* Backdrop for mobile */}
        <div className="absolute inset-0 bg-stone-900/20 backdrop-blur-sm lg:hidden" onClick={() => setMobileMenuOpen(false)} />
        
        <aside className={clsx(
          "absolute left-0 top-0 bottom-0 w-72 bg-white/80 backdrop-blur-xl border-r border-stone-200/60 transform transition-transform duration-300 ease-in-out lg:relative lg:transform-none lg:transition-none",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}>
          <SidebarNav active={activeNav} onLogout={doLogout} />
        </aside>
      </div>

      <div className="flex-1 overflow-auto relative mt-16 lg:mt-0">
        <TopError error={error} onClose={() => setError(null)} />
        <div className="mx-auto max-w-[1600px] p-4 sm:p-8 lg:p-10">
            {/* Top User Info Removed as it is now in Dashboard Header or redundant */}

          <div className="space-y-8">
            {route.name === "dashboard" && admin && <DashboardView admin={admin} />}
            {route.name === "users" && <UsersView onOpenUser={(id) => adminNavigate(`/admin/users/${id}`)} />}
            {route.name === "user" && (
              <UserDetailView userId={route.userId} onBack={() => adminNavigate("/admin/users")} />
            )}
            {route.name === "admins" && <AdminsView currentAdmin={admin} />}
            {route.name === "settings" && <SettingsView currentAdmin={admin} onAdminUpdate={setAdmin} />}
            {route.name === "cycle" && <CycleMonitoringView />}
            {route.name === "ai" && <AiMonitoringView />}
            {route.name === "analytics" && <AnalyticsView />}
            {route.name === "feedback" && <FeedbackView />}
            {route.name === "notifications" && <NotificationsView />}
            {route.name === "profile" && <SettingsView currentAdmin={admin} onAdminUpdate={setAdmin} />}
          </div>
        </div>
      </div>
    </div>
  );
}
