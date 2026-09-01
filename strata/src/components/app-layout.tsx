import { Link, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { LayoutGridIcon, FilesIcon, SearchIcon } from "lucide-react";

const NAV_LINKS = [
  { to: "/", label: "Containers", icon: LayoutGridIcon },
  { to: "/documents", label: "Documents", icon: FilesIcon },
  { to: "/query", label: "Query", icon: SearchIcon },
];

export function AppLayout() {
  const location = useLocation();

  function isActive(to: string) {
    if (to === "/") {
      return location.pathname === "/" || location.pathname.startsWith("/containers");
    }
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  }

  return (
    <div className="flex min-h-screen" style={{ background: "#FCFCFA" }}>
      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <aside
        className="flex w-[240px] shrink-0 flex-col border-r"
        style={{
          background: "#F5F3EE",
          borderColor: "#E5E2DA",
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-6 py-5">
          <span
            className="text-base font-semibold tracking-tight"
            style={{ color: "#1A1A1A" }}
          >
            Strata
          </span>
          {/* Lime-green accent dot */}
          <span
            className="size-1.5 rounded-full"
            style={{ background: "#CCFF01" }}
          />
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 px-3">
          {NAV_LINKS.map(({ to, label, icon: Icon }) => {
            const active = isActive(to);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "font-medium"
                    : "hover:bg-black/5",
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
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Version footer */}
        <div className="mt-auto px-6 py-4">
          <span className="text-[11px]" style={{ color: "#B8B4AC" }}>
            v0.1 · Document Intelligence
          </span>
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
