/**
 * src/pages/topografo/Painel.tsx
 *
 * Home de quem loga como topógrafo (papel === "topografo", ver
 * AuthContext.tsx) -- equivalente ao Dashboard.tsx do admin, mas
 * escopado ao próprio topógrafo. Usa GET /topografo/me/estatisticas
 * (contagem de clientes/terrenos já calculada em SQL no Backend).
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../../components/Layout";
import { StatCard } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

type Estatisticas = { clientes: number; terrenos: number };

export function PainelTopografo() {
  const { topografo } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Estatisticas | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api
      .get("/topografo/me/estatisticas")
      .then(setStats)
      .catch((err) =>
        setErro(err instanceof ApiError ? err.message : "Erro ao carregar estatísticas")
      );
  }, []);

  return (
    <Layout>
      <h1 className="text-2xl font-semibold text-vertente-dark">
        Olá, {topografo?.nome ?? "topógrafo"}
      </h1>
      <p className="mt-1 text-sm text-vertente-medium">
        Seus clientes e terrenos cadastrados.
      </p>

      {erro && (
        <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>
      )}

      {!erro && (
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <StatCard label="Clientes" value={stats?.clientes ?? "—"} />
          <StatCard label="Terrenos" value={stats?.terrenos ?? "—"} />
          {topografo?.limite_terrenos != null && (
            <StatCard label="Limite de terrenos (plano)" value={topografo.limite_terrenos} />
          )}
        </div>
      )}

      <button
        onClick={() => navigate("/meus-clientes")}
        className="mt-8 rounded-lg bg-vertente px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-vertente-dark"
      >
        Ver meus clientes
      </button>
    </Layout>
  );
}
