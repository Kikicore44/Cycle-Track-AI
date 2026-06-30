import { AdminUser, getAdminToken } from "./adminStorage";

async function parseJsonSafely(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export class AdminApiError extends Error {
  status: number;
  payload: any;
  constructor(message: string, status: number, payload: any) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

async function adminFetch<T = any>(path: string, init?: RequestInit): Promise<T> {
  const token = getAdminToken();
  const headers = new Headers(init?.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && init?.body) headers.set("Content-Type", "application/json");
  headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
  headers.set("Pragma", "no-cache");

  const res = await fetch(path, { ...init, headers, cache: "no-store" });
  const payload = await parseJsonSafely(res);
  if (!res.ok) {
    const msg = payload?.error ? String(payload.error) : `Request failed (${res.status})`;
    throw new AdminApiError(msg, res.status, payload);
  }
  return payload as T;
}

export async function adminSignup(input: {
  name: string;
  email: string;
  password: string;
  inviteCode?: string;
  role?: string;
}): Promise<{ admin: AdminUser; token: string; expiresAt: string }> {
  const payload = await adminFetch("/api/admin/signup", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return { admin: payload.admin, token: payload.token, expiresAt: payload.expiresAt };
}

export async function adminLogin(input: { email: string; password: string }): Promise<{ admin: AdminUser; token: string; expiresAt: string }> {
  const payload = await adminFetch("/api/admin/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return { admin: payload.admin, token: payload.token, expiresAt: payload.expiresAt };
}

export async function adminMe(): Promise<{ admin: AdminUser }> {
  const payload = await adminFetch("/api/admin/me");
  return { admin: payload.admin };
}

export async function adminLogout(): Promise<void> {
  await adminFetch("/api/admin/logout", { method: "POST" });
}

export async function adminGetStats() {
  return adminFetch<{ stats: {
    users: number;
    active_today: number;
    active_now: number;
    new_this_month: number;
    logs: number;
    period_dates: number;
    admins: number;
    ai_total: number;
    avg_cycle_length: string;
    total_used_today_seconds: number;
    active_users: Array<{ user_id: number; user_name: string; email: string; last_seen_at: string; active_seconds_today: number }>;
  } }>("/api/admin/stats");
}

export async function adminGetUsersStats() {
  return adminFetch<{ stats: { total: number; active_today: number; active_now: number; new_this_month: number; inactive: number; total_used_today_seconds: number } }>("/api/admin/users/stats");
}

export async function adminGetCycleSummary() {
  return adminFetch<{ 
    summary: { 
      avgCycleLength: string; 
      avgPeriodDuration: string; 
      totalRecords: number; 
      irregularPercentage: number;
      symptoms: Array<{ name: string; count: number }>;
      distribution: { short: number; normal: number; long: number }
    } 
  }>("/api/admin/analytics/cycle-summary");
}

export async function adminListAnonymizedCycles(params: { minLength?: number; maxLength?: number; dateFrom?: string; dateTo?: string; limit?: number; offset?: number }) {
  const qs = new URLSearchParams();
  if (params.minLength) qs.set("minLength", String(params.minLength));
  if (params.maxLength) qs.set("maxLength", String(params.maxLength));
  if (params.dateFrom) qs.set("dateFrom", params.dateFrom);
  if (params.dateTo) qs.set("dateTo", params.dateTo);
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.offset) qs.set("offset", String(params.offset));
  
  return adminFetch<{ cycles: any[]; total: number }>(`/api/admin/analytics/cycles?${qs.toString()}`);
}

export async function adminGetRecentActivity() {
  return adminFetch<{ activity: Array<{ user_id: number; user_name: string; action: string; timestamp: string }> }>("/api/admin/activity/recent");
}

export async function adminGetAiAccuracyReport() {
  return adminFetch<{ report: { total: number; accuracy: number; mismatches: number; lastUpdate: string } }>("/api/admin/ai/accuracy-report");
}

export async function adminGetAiComparisonData() {
  return adminFetch<{ data: Array<{ prediction_date: string; actual_date: string; accuracy_offset: number }> }>("/api/admin/ai/comparison");
}

export async function adminGetDailyStats() {
  return adminFetch<{ stats: Array<{ date: string; users: number; logs: number }> }>("/api/admin/stats/daily");
}

export async function adminListUsers(input: { q?: string; limit?: number; offset?: number; status?: string }): Promise<{ users: Array<{ id: number; name: string; email: string; dob: string | null; created_at: string | null; last_login_at: string | null; is_active: number }>; total: number }> {
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  if (typeof input.limit === "number") params.set("limit", String(input.limit));
  if (typeof input.offset === "number") params.set("offset", String(input.offset));
  if (input.status) params.set("status", input.status);
  
  const payload = await adminFetch(`/api/admin/users?${params.toString()}`);
  return payload;
}

export async function adminGetUser(userId: number): Promise<{ user: { id: number; name: string; email: string; dob: string | null; predictionsCount: number; lastCycleDate: string | null }; summary: { logsCount: number; periodDatesCount: number } }> {
  const payload = await adminFetch(`/api/admin/users/${userId}`);
  return payload;
}

export async function adminGetUserLogs(userId: number): Promise<{ logs: Array<{ date: string; symptoms: string[]; pain: number | null; mood: string | null; notes: string | null }> }> {
  const payload = await adminFetch(`/api/admin/users/${userId}/logs`);
  return payload;
}

export async function adminGetUserPeriodDates(userId: number): Promise<{ dates: string[] }> {
  const payload = await adminFetch(`/api/admin/users/${userId}/period-dates`);
  return payload;
}

export async function adminResetUserPassword(userId: number, password: string): Promise<void> {
  await adminFetch(`/api/admin/users/${userId}/reset-password`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function adminDeleteUser(userId: number): Promise<void> {
  await adminFetch(`/api/admin/users/${userId}`, { method: "DELETE" });
}

export async function adminListAdmins(input: { q?: string; limit?: number }): Promise<{ admins: AdminUser[] }> {
  const q = input.q ? `q=${encodeURIComponent(input.q)}` : "";
  const limit = typeof input.limit === "number" ? `limit=${encodeURIComponent(String(input.limit))}` : "";
  const qs = [q, limit].filter(Boolean).join("&");
  const payload = await adminFetch(`/api/admin/admins${qs ? `?${qs}` : ""}`);
  return payload;
}

export async function adminCreateAdmin(input: { name: string; email: string; password: string; role?: string }): Promise<{ admin: AdminUser }> {
  const payload = await adminFetch("/api/admin/admins", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return payload;
}

export async function adminResetAdminPassword(adminUserId: number, password: string): Promise<void> {
  await adminFetch(`/api/admin/admins/${adminUserId}/reset-password`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function adminDeleteAdmin(adminUserId: number): Promise<void> {
  await adminFetch(`/api/admin/admins/${adminUserId}`, { method: "DELETE" });
}

export async function adminGetCycleMonitoring() {
  return adminFetch<{ avgCycleLength: string; topSymptoms: Array<{ name: string; count: number }>; totalLogs: number }>("/api/admin/cycle-monitoring");
}

export async function adminListFeedback() {
  return adminFetch<{ feedback: Array<{ id: number; user_name: string; message: string; is_resolved: number; created_at: string }> }>("/api/admin/feedback");
}

export async function adminResolveFeedback(id: number) {
  return adminFetch("/api/admin/feedback/" + id + "/resolve", { method: "POST" });
}

export async function adminDeleteFeedback(id: number) {
  return adminFetch("/api/admin/feedback/" + id, { method: "DELETE" });
}

export async function adminListArticles() {
  return adminFetch<{ articles: Array<{ id: number; title: string; category: string; content: string; author_name: string; is_published: number; created_at: string }> }>("/api/admin/articles");
}

export async function adminSaveArticle(a: { id?: number; title: string; category: string; content: string; is_published: boolean }) {
  return adminFetch("/api/admin/articles", {
    method: "POST",
    body: JSON.stringify(a),
  });
}

export async function adminDeleteArticle(id: number) {
  return adminFetch("/api/admin/articles/" + id, { method: "DELETE" });
}

export async function adminListNotifications() {
  return adminFetch<{ notifications: Array<{ id: number; type: string; title: string; message: string; target_group: string; target_user_id: number | null; scheduled_for: string | null; created_at: string }> }>("/api/admin/notifications");
}

export async function adminCreateNotification(n: { type: string; title: string; message: string; target_group?: string; target_user_id?: number | null; scheduled_for?: string | null }) {
  return adminFetch("/api/admin/notifications", {
    method: "POST",
    body: JSON.stringify(n),
  });
}

export async function adminUpdateNotification(id: number, n: { type: string; title: string; message: string; target_group?: string; target_user_id?: number | null; scheduled_for?: string | null }) {
  return adminFetch("/api/admin/notifications/" + id, {
    method: "PUT",
    body: JSON.stringify(n),
  });
}

export async function adminDeleteNotification(id: number) {
  return adminFetch("/api/admin/notifications/" + id, { method: "DELETE" });
}

export async function adminUpdateMe(input: { email: string }) {
  return adminFetch<{ admin: AdminUser }>("/api/admin/me", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function adminGetAiSettings() {
  return adminFetch<{ settings: { model_version: string; prediction_threshold: string; last_training_date: string; theme_accent: string } }>("/api/admin/settings/ai");
}

export async function adminSaveAiSettings(input: { model_version: string; prediction_threshold: string; last_training_date: string; theme_accent: string }) {
  return adminFetch<{ settings: { model_version: string; prediction_threshold: string; last_training_date: string; theme_accent: string } }>("/api/admin/settings/ai", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function adminToggleUserActive(userId: number, isActive: boolean) {
  return adminFetch(`/api/admin/users/${userId}/toggle-active`, {
    method: "POST",
    body: JSON.stringify({ is_active: isActive }),
  });
}

export async function adminExportData(type: "users" | "daily" | "cycles") {
  const token = getAdminToken();
  const res = await fetch(`/api/admin/analytics/export?type=${type}`, {
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `export-${type}-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
}

export async function getDbStatus(): Promise<any> {
  return await adminFetch("/api/db-status");
}

export async function getAiStatus(): Promise<any> {
  return await adminFetch("/api/ai/status");
}
