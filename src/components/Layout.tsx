import { type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ContourLines } from "./ContourLines";

const navItems = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/terrenos", label: "Terrenos" },
  { to: "/terrenos/novo", label: "Novo Terreno" },
  { to: "/usuarios", label: "Usuários" },
  { to: "/configuracoes", label: "Configurações" },
];

export function Layout({ children }: { children: ReactNode }) {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="flex min-h-screen bg-vertente-bg">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col bg-vertente-dark text-white">
        <div className="relative overflow-hidden border-b border-white/10 px-6 py-6">
          <ContourLines className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 text-vertente-light" />
          <p className="relative font-display text-lg font-semibold tracking-tight">
            Vertente
          </p>
          <p className="relative text-xs uppercase tracking-widest text-vertente-light/80">
            Admin
          </p>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-6">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          className="mx-3 mb-6 rounded-xl border border-white/15 px-4 py-2.5 text-left text-sm font-medium text-white/80 transition-colors hover:bg-white/5 hover:text-white"
        >
          Sair
        </button>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-black/5 bg-white px-8 py-4">
          <p className="text-sm text-vertente-medium">Painel administrativo</p>
          <p className="text-sm font-medium text-vertente-ink">
            {admin?.nome}
          </p>
        </header>

        <main className="flex-1 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
