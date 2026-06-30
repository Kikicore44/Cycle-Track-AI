export type AdminUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
  last_login_at: string | null;
};

const TOKEN_KEY = "admin_token";
const ADMIN_KEY = "admin_user";

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string | null) {
  try {
    if (!token) localStorage.removeItem(TOKEN_KEY);
    else localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore
  }
}

export function getStoredAdmin(): AdminUser | null {
  try {
    const raw = localStorage.getItem(ADMIN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AdminUser;
  } catch {
    return null;
  }
}

export function setStoredAdmin(admin: AdminUser | null) {
  try {
    if (!admin) localStorage.removeItem(ADMIN_KEY);
    else localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
  } catch {
    // ignore
  }
}

export function clearAdminAuth() {
  setAdminToken(null);
  setStoredAdmin(null);
}

