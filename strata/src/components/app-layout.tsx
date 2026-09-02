import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import {
  LayoutGridIcon,
  FilesIcon,
  SearchIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SunIcon,
  MoonIcon,
} from "lucide-react";

const NAV_LINKS = [
  { to: "/dashboard", label: "Containers", icon: LayoutGridIcon },
  { to: "/documents", label: "Documents", icon: FilesIcon },
  { to: "/query", label: "Query", icon: SearchIcon },
];

export function AppLayout() {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("strata_sidebar_collapsed") === "true";
    }
    return false;
  });

  const dark = theme === "dark";

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("strata_sidebar_collapsed", String(next));
      return next;
    });
  };

  function isActive(to: string) {
    if (to === "/dashboard") {
      return location.pathname === "/dashboard" || location.pathname.startsWith("/containers");
    }
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  }

  return (
    <div
      className="flex min-h-screen transition-colors duration-200"
      style={{ background: dark ? "#0F1117" : "#F8F7F2" }}
    >
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className={cn(
          "flex shrink-0 flex-col border-r transition-all duration-300 ease-in-out select-none",
          collapsed ? "w-[64px]" : "w-[240px]"
        )}
        style={{
          background: dark ? "#161B22" : "#FFFFFF",
          borderColor: dark ? "#30363D" : "#E5E7EB",
        }}
      >
        {/* ── Logo + Collapse Toggle ─────────────────────────────────── */}
        <div
          className={cn(
            "flex items-center py-4 transition-all",
            collapsed ? "flex-col gap-3 px-3" : "justify-between px-4"
          )}
          style={{ borderBottom: `1px solid ${dark ? "#30363D" : "#E5E7EB"}` }}
        >
          <Link
            to="/"
            className="flex items-center gap-1.5 hover:opacity-75 transition-opacity overflow-hidden shrink-0"
            title="Strata Document Intelligence"
          >
            <span
              className="text-base font-bold tracking-tight font-[Syne,sans-serif] leading-none"
              style={{ color: dark ? "#F0F6FC" : "#111827" }}
            >
              {collapsed ? "S" : "Strata"}
            </span>
            <span
              className="size-1.5 rounded-full shrink-0"
              style={{
                background: "#CCFF01",
                boxShadow: "0 0 6px rgba(204,255,1,0.7)",
              }}
            />
          </Link>

          <button
            type="button"
            onClick={toggleCollapse}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex size-7 items-center justify-center rounded-md transition-colors shrink-0",
              dark
                ? "text-[#8B949E] hover:bg-white/5 hover:text-[#F0F6FC]"
                : "text-[#6B7280] hover:bg-black/5 hover:text-[#111827]"
            )}
          >
            {collapsed ? (
              <ChevronRightIcon className="size-3.5" />
            ) : (
              <ChevronLeftIcon className="size-3.5" />
            )}
          </button>
        </div>

        {/* ── Nav Links ──────────────────────────────────────────────── */}
        <nav className={cn("flex flex-col gap-0.5 py-3", collapsed ? "px-2" : "px-3")}>
          {NAV_LINKS.map(({ to, label, icon: Icon }) => {
            const active = isActive(to);
            return (
              <Link
                key={to}
                to={to}
                title={collapsed ? label : undefined}
                className={cn(
                  "group relative flex items-center rounded-md transition-all duration-150",
                  collapsed ? "justify-center h-9 w-full" : "gap-2.5 px-3 h-9",
                  !active && (dark ? "hover:bg-white/5" : "hover:bg-black/5")
                )}
                style={
                  active
                    ? {
                        background: dark ? "rgba(204,255,1,0.08)" : "#F0F9E8",
                        color: dark ? "#CCFF01" : "#111827",
                        fontWeight: 600,
                      }
                    : {
                        color: dark ? "#8B949E" : "#6B7280",
                      }
                }
              >
                {/* Active left border indicator */}
                {active && (
                  <span
                    className="absolute left-0 top-1 h-[calc(100%-8px)] w-[3px] rounded-full"
                    style={{ background: "#CCFF01" }}
                  />
                )}
                <Icon
                  className="size-4 shrink-0"
                  style={{ color: active ? (dark ? "#CCFF01" : "#111827") : dark ? "#8B949E" : "#9CA3AF" }}
                />
                {!collapsed && (
                  <span className="truncate text-sm">{label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* ── Sidebar Footer — Version + Theme Toggle ─────────────────── */}
        <div
          className={cn(
            "mt-auto flex items-center py-4 transition-all",
            collapsed ? "flex-col gap-2 px-2" : "justify-between px-4"
          )}
          style={{ borderTop: `1px solid ${dark ? "#30363D" : "#E5E7EB"}` }}
        >
          {!collapsed && (
            <span
              className="text-[11px] truncate"
              style={{ color: dark ? "#8B949E" : "#9CA3AF" }}
            >
              v0.1 · Doc Intelligence
            </span>
          )}

          {/* Theme toggle button */}
          <button
            type="button"
            onClick={toggleTheme}
            title={dark ? "Switch to light mode" : "Switch to dark mode"}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium border transition-all duration-200",
              collapsed && "w-full justify-center px-0 py-2 rounded-md",
              dark
                ? "border-[#30363D] text-[#8B949E] hover:text-[#F0F6FC] hover:border-[#8B949E]"
                : "border-[#E5E7EB] text-[#6B7280] hover:text-[#111827] hover:border-[#9CA3AF]"
            )}
          >
            {dark ? (
              <SunIcon className="size-3.5 shrink-0" />
            ) : (
              <MoonIcon className="size-3.5 shrink-0" />
            )}
            {!collapsed && <span>{dark ? "Light" : "Dark"}</span>}
          </button>
        </div>
      </aside>

      {/* ── Main Content Area ────────────────────────────────────────── */}
      <main
        className="flex-1 overflow-auto transition-colors duration-200"
        style={{ background: dark ? "#0F1117" : "#F8F7F2" }}
      >
        {/* ── Topbar ────────────────────────────────────────────────── */}
        <div
          className="sticky top-0 z-10 flex items-center h-14 px-8 border-b transition-colors duration-200"
          style={{
            background: dark ? "#161B22" : "#FFFFFF",
            borderColor: dark ? "#30363D" : "#E5E7EB",
          }}
        >
          {/* Breadcrumb: current page */}
          <span
            className="text-sm font-medium"
            style={{ color: dark ? "#8B949E" : "#6B7280" }}
          >
            {NAV_LINKS.find((l) => isActive(l.to))?.label ?? "Strata"}
          </span>
        </div>

        <div className="px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
