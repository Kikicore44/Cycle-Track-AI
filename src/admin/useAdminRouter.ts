import { useEffect, useMemo, useState } from "react";

export type AdminRoute =
  | { name: "login" }
  | { name: "signup" }
  | { name: "dashboard" }
  | { name: "users" }
  | { name: "user"; userId: number }
  | { name: "cycle" }
  | { name: "ai" }
  | { name: "analytics" }
  | { name: "feedback" }
  | { name: "notifications" }
  | { name: "settings" }
  | { name: "profile" }
  | { name: "admins" };

function parseAdminRoute(pathname: string): AdminRoute {
  const path = pathname.startsWith("/admin") ? pathname.slice("/admin".length) : pathname;
  const clean = (path || "/").replace(/\/+$/, "") || "/";

  if (clean === "/" || clean === "") return { name: "dashboard" };
  if (clean === "/login") return { name: "login" };
  if (clean === "/signup") return { name: "signup" };
  if (clean === "/dashboard") return { name: "dashboard" };
  if (clean === "/users") return { name: "users" };
  if (clean === "/cycle") return { name: "cycle" };
  if (clean === "/ai") return { name: "ai" };
  if (clean === "/analytics") return { name: "analytics" };
  if (clean === "/feedback") return { name: "feedback" };
  if (clean === "/notifications") return { name: "notifications" };
  if (clean === "/settings") return { name: "settings" };
  if (clean === "/profile") return { name: "profile" };
  if (clean === "/admins") return { name: "admins" };

  const m = clean.match(/^\/users\/(\d+)$/);
  if (m) return { name: "user", userId: Number(m[1]) };

  return { name: "dashboard" };
}

export function adminNavigate(to: string, replace = false) {
  const url = to.startsWith("/admin") ? to : `/admin${to.startsWith("/") ? "" : "/"}${to}`;
  if (replace) window.history.replaceState({}, "", url);
  else window.history.pushState({}, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function useAdminRoute() {
  const [pathname, setPathname] = useState(() => (typeof window === "undefined" ? "/admin" : window.location.pathname));

  useEffect(() => {
    const onPop = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const route = useMemo(() => parseAdminRoute(pathname), [pathname]);
  return { route, pathname };
}
