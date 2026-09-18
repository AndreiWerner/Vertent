import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";

// Qualquer sessão válida (admin OU topógrafo) passa aqui -- quem
// decide o que cada papel pode ver são AdminRoute/TopografoRoute
// abaixo, usados dentro das rotas específicas de cada área.
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { papel, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-vertente-bg text-vertente-medium">
        Carregando...
      </div>
    );
  }

  if (!papel) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Páginas exclusivas do administrador (gestão global de usuários,
// terrenos, topógrafos, configurações). Um topógrafo logado que tente
// acessar por URL direta é mandado para a própria área dele, não para
// login -- ele TEM sessão válida, só não tem permissão para esta tela.
export function AdminRoute({ children }: { children: ReactNode }) {
  const { papel, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-vertente-bg text-vertente-medium">
        Carregando...
      </div>
    );
  }

  if (!papel) return <Navigate to="/login" replace />;
  if (papel !== "admin") return <Navigate to="/" replace />;

  return <>{children}</>;
}

// Páginas exclusivas do topógrafo (meus clientes/terrenos). Mesmo
// raciocínio do AdminRoute, espelhado.
export function TopografoRoute({ children }: { children: ReactNode }) {
  const { papel, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-vertente-bg text-vertente-medium">
        Carregando...
      </div>
    );
  }

  if (!papel) return <Navigate to="/login" replace />;
  if (papel !== "topografo") return <Navigate to="/" replace />;

  return <>{children}</>;
}
