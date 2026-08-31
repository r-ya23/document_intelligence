import { Link, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { to: "/", label: "Containers" },
  { to: "/documents", label: "Documents" },
  { to: "/query", label: "Query" },
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
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
          <span className="text-lg font-semibold">Strata</span>
          <nav className="flex gap-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  "text-sm text-muted-foreground transition-colors hover:text-foreground",
                  isActive(link.to) && "text-foreground font-medium",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
