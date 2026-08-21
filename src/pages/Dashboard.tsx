import { useEffect, useState } from "react";
import { Layout } from "../components/Layout";
import { StatCard, StatusBadge } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";

type Resumo = {
  totalTerrenos: number;
  totalUsuarios: number;
  usuariosAtivos: number;
  usuariosInativos: number;
  terrenosRecentes: {
    nome: string;
    matricula: string;
    status: "ativo" | "inativo";
    area: string | null;
  }[];
};

export function Dashboard() {
  const { admin } = useAuth();
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api
      .get("/admin/dashboard")
      .then(setResumo)
      .catch((err) =>
        setErro(err instanceof ApiError ? err.message : "Erro ao carregar dashboard")
      );
  }, []);

  return (
    <Layout>
      <h1 className="text-2xl font-semibold text-vertente-dark">
        Olá, {admin?.nome?.split(" ")[0]}
      </h1>
      <p className="mt-1 text-sm text-vertente-medium">
        Resumo dos terrenos e usuários cadastrados.
      </p>

      {erro && (
        <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </p>
      )}

      {resumo && (
        <>
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Terrenos" value={resumo.totalTerrenos} />
            <StatCard label="Usuários" value={resumo.totalUsuarios} />
            <StatCard label="Usuários ativos" value={resumo.usuariosAtivos} />
            <StatCard label="Usuários inativos" value={resumo.usuariosInativos} />
          </div>

          <div className="mt-8 rounded-xl2 bg-white p-6 shadow-card">
            <h2 className="mb-4 text-base font-semibold text-vertente-dark">
              Terrenos recentes
            </h2>

            {resumo.terrenosRecentes.length === 0 ? (
              <p className="text-sm text-vertente-medium">
                Nenhum terreno cadastrado ainda.
              </p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-vertente-bg text-vertente-medium">
                    <th className="pb-2 font-medium">Cliente</th>
                    <th className="pb-2 font-medium">Matrícula</th>
                    <th className="pb-2 font-medium">Área</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {resumo.terrenosRecentes.map((t) => (
                    <tr key={t.matricula} className="border-b border-vertente-bg/60">
                      <td className="py-3">{t.nome}</td>
                      <td className="py-3">{t.matricula}</td>
                      <td className="py-3">{t.area ?? "—"}</td>
                      <td className="py-3">
                        <StatusBadge status={t.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </Layout>
  );
}
