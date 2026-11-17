import { NavLink, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "./ThemeToggle";
import { useState } from "react";

const Navbar = () => {
  const { role, name, logout } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
    setIsMenuOpen(false);
  };

  const getHomeLink = () => {
    if (!role) return "/";
    if (role === "hr") return "/hr";
    return "/dashboard";
  };

  const links = [];
  if (role === "admin" || role === "sa" || role === "user") {
    links.push({ to: "/dashboard", label: "Dashboard" });
  }
  if (role === "admin" || role === "sa") {
    links.push({ to: "/online", label: "Online" });
  }
  if (role === "admin" || role === "sa" || role === "hr") {
    links.push(
      { to: "/hr", label: "HR" },
      { to: "/drivers", label: "Drivers" },
      { to: "/groups", label: "Groups" },
      { to: "/billing", label: "Billing" }
    );
  }
  if (role === "admin" || role === "sa") {
    links.push({ to: "/users", label: "Users" });
  }
  if (role === "sa") {
    links.push({ to: "/logs", label: "Logs" });
  }

  const navLinkClass = ({ isActive }) =>
    `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive
        ? "bg-blue-600/20 text-blue-300"
        : "text-slate-300 hover:bg-white/5 hover:text-white"
    }`;

  const mobileLinkClass = ({ isActive }) =>
    `block rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
      isActive
        ? "bg-blue-600/20 text-blue-300"
        : "text-slate-200 hover:bg-white/5"
    }`;

  return (
    <nav className="sticky top-0 z-40 border-b border-slate-700/70 bg-[#111c34] text-white shadow-lg">
      <div className="flex min-h-16 items-center gap-6 px-4 sm:px-6">
        <Link to={getHomeLink()} className="shrink-0 text-base font-bold tracking-tight text-white">
          Caucasus Group
        </Link>

        {!role ? (
          <div className="ml-auto flex items-center gap-2">
            <Link to="/login" className="rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-white/5">Login</Link>
            <Link to="/register" className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium hover:bg-blue-500">Sign up</Link>
          </div>
        ) : (
          <>
            <div className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto lg:flex">
              {links.map(({ to, label }) => (
                <NavLink key={to} to={to} className={navLinkClass}>
                  {label}
                </NavLink>
              ))}
            </div>

            <div className="ml-auto hidden shrink-0 items-center gap-3 lg:flex">
              <span className="max-w-36 truncate text-xs text-slate-300" title={name || ""}>
                {name}
              </span>
              <ThemeToggle />
              <button
                onClick={handleLogout}
                className="rounded-lg px-2.5 py-2 text-xs font-medium text-slate-300 hover:bg-white/5 hover:text-white"
              >
                Sign out
              </button>
            </div>

            <div className="ml-auto flex items-center gap-2 lg:hidden">
              <ThemeToggle />
              <button
                onClick={() => setIsMenuOpen((open) => !open)}
                className="rounded-lg p-2 text-slate-200 hover:bg-white/5"
                aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
                aria-expanded={isMenuOpen}
              >
                {isMenuOpen ? (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                    <path d="m6 6 12 12M18 6 6 18" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                    <path d="M4 6h16M4 12h16M4 18h16" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                )}
              </button>
            </div>
          </>
        )}
      </div>

      {role && isMenuOpen && (
        <div className="border-t border-slate-700/70 px-3 py-3 lg:hidden">
          {name && <p className="px-4 pb-2 text-xs text-slate-400">Signed in as {name}</p>}
          <div className="grid gap-1">
            {links.map(({ to, label }) => (
              <NavLink key={to} to={to} className={mobileLinkClass} onClick={() => setIsMenuOpen(false)}>
                {label}
              </NavLink>
            ))}
            <button
              onClick={handleLogout}
              className="mt-1 rounded-lg px-4 py-2.5 text-left text-sm font-medium text-red-300 hover:bg-red-500/10"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
