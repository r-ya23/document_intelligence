import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  SparklesIcon,
  LayoutGridIcon,
  FilesIcon,
  SearchIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";

const NAV_LINKS = [
  { to: "/", label: "Overview", icon: SparklesIcon },
  { to: "/dashboard", label: "Containers", icon: LayoutGridIcon },
  { to: "/documents", label: "Documents", icon: FilesIcon },
  { to: "/query", label: "Query", icon: SearchIcon },
];

export function AppLayout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("strata_sidebar_collapsed") === "true";
    }
    return false;
  });

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("strata_sidebar_collapsed", String(next));
      return next;
    });
  };

  function isActive(to: string) {
    if (to === "/") {
      return location.pathname === "/";
    }
    if (to === "/dashboard") {
      return location.pathname === "/dashboard" || location.pathname.startsWith("/containers");
    }
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  }

  return (
    <div className="flex min-h-screen" style={{ background: "#FCFCFA" }}>
      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <aside
        className={cn(
          "flex shrink-0 flex-col border-r transition-all duration-300 ease-in-out relative select-none",
          collapsed ? "w-[68px]" : "w-[240px]"
        )}
        style={{
          background: "#F5F3EE",
          borderColor: "#E5E2DA",
        }}
      >
        {/* Logo and Collapse Toggle Header */}
        <div
          className={cn(
            "flex items-center py-5 transition-all",
            collapsed ? "flex-col gap-3 px-2" : "justify-between px-5"
          )}
        >
          <Link
            to="/"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity overflow-hidden"
            title="Strata Document Intelligence"
          >
            <span
              className="text-base font-semibold tracking-tight"
              style={{ color: "#1A1A1A" }}
            >
              {collapsed ? "S" : "Strata"}
            </span>
            {/* Lime-green accent dot */}
            <span
              className="size-1.5 rounded-full shrink-0"
              style={{ background: "#CCFF01" }}
            />
          </Link>

          <button
            type="button"
            onClick={toggleCollapse}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex size-7 items-center justify-center rounded-md text-[#6B6B6B] hover:bg-black/5 hover:text-[#1A1A1A] transition-colors shrink-0"
          >
            {collapsed ? (
              <ChevronRightIcon className="size-4" />
            ) : (
              <ChevronLeftIcon className="size-4" />
            )}
          </button>
        </div>

        {/* Nav Links */}
        <nav className={cn("flex flex-col gap-1", collapsed ? "px-2" : "px-3")}>
          {NAV_LINKS.map(({ to, label, icon: Icon }) => {
            const active = isActive(to);
            return (
              <Link
                key={to}
                to={to}
                title={collapsed ? label : undefined}
                className={cn(
                  "group relative flex items-center rounded-md py-2 text-sm transition-all",
                  collapsed ? "justify-center h-10 w-full" : "gap-3 px-3",
                  active ? "font-medium" : "hover:bg-black/5"
                )}
                style={
                  active
                    ? { color: "#1A1A1A", background: "rgba(0,0,0,0.06)" }
                    : { color: "#6B6B6B" }
                }
              >
                {/* Active left border strip */}
                {active && (
                  <span
                    className="absolute left-0 top-1 h-[calc(100%-8px)] w-0.5 rounded-full"
                    style={{ background: "#CCFF01" }}
                  />
                )}
                <Icon
                  className="size-4 shrink-0"
                  style={{
                    color: active ? "#1A1A1A" : "#9B9B9B",
                  }}
                />
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Version Footer */}
        <div
          className={cn(
            "mt-auto py-4 transition-all",
            collapsed ? "px-2 text-center" : "px-5"
          )}
        >
          <span
            className="text-[11px] block truncate"
            style={{ color: "#B8B4AC" }}
            title="v0.1 · Document Intelligence"
          >
            {collapsed ? "v0.1" : "v0.1 · Document Intelligence"}
          </span>
        </div>
      </aside>

      {/* ── Main Content Area ───────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto px-8 py-8 transition-all">
        <Outlet />
      </main>
    </div>
  );
}
