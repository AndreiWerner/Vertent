import { useEffect, useState } from "react";
import { Layout } from "../components/Layout";
import { StatCard, StatusBadge } from "../components/ui";
import { api, ApiError, classificarErro } from "../lib/api";
import { formatMoeda } from "../lib/format";
import { calcularMensalidade, obterPrecoPorTerreno } from "../lib/pricing";
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

// ETAPA TOPÓGRAFOS -- resumo isolado do `resumo` acima (estado e fetch
// próprios): uma falha aqui (ex.: endpoint ainda não existe no
// Backend, ver relatório da etapa) nunca esconde o restante do
// dashboard, que já funcionava antes desta etapa.
type ResumoTopografos = { total: number; clientesTotal: number; terrenosTotal: number };

export function Dashboard() {
  const { admin } = useAuth();
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const [resumoTopografos, setResumoTopografos] = useState<ResumoTopografos | null>(null);
  const [erroTopografos, setErroTopografos] = useState<string | null>(null);
  const [endpointTopografosPendente, setEndpointTopografosPendente] = useState(false);

  useEffect(() => {
    api
      .get("/admin/dashboard")
      .then(setResumo)
      .catch((err) =>
        setErro(err instanceof ApiError ? err.message : "Erro ao carregar dashboard")
      );
  }, []);

  useEffect(() => {
    api
      .get("/admin/topografos")
      .then((lista: Array<{ clientesCount?: number; terrenosCount?: number }>) => {
        const listaSegura = Array.isArray(lista) ? lista : [];
        setResumoTopografos({
          total: listaSegura.length,
          clientesTotal: listaSegura.reduce((soma, t) => soma + (t.clientesCount ?? 0), 0),
          terrenosTotal: listaSegura.reduce((soma, t) => soma + (t.terrenosCount ?? 0), 0),
        });
      })
      .catch((err) => {
        const { mensagem, endpointPendente } = classificarErro(err);
        if (endpointPendente) setEndpointTopografosPendente(true);
        else setErroTopografos(mensagem);
      });
  }, []);

  const precoPorTerreno = obterPrecoPorTerreno();

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

      {/* ETAPA TOPÓGRAFOS -- "Valor mensal calculado" (não "Receita
          recebida": não há sistema de pagamento ainda, ver seção 8 da
          especificação). */}
      <div className="mt-8 rounded-xl2 bg-white p-6 shadow-card">
        <h2 className="mb-4 text-base font-semibold text-vertente-dark">Topógrafos</h2>

        {endpointTopografosPendente && (
          <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Este resumo depende de um endpoint administrativo que ainda não existe no
            Backend (GET /admin/topografos). Veja o relatório desta etapa para os detalhes.
          </p>
        )}

        {erroTopografos && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erroTopografos}</p>
        )}

        {resumoTopografos && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Topógrafos" value={resumoTopografos.total} />
            <StatCard label="Clientes" value={resumoTopografos.clientesTotal} />
            <StatCard label="Terrenos" value={resumoTopografos.terrenosTotal} />
            <StatCard label="Preço por terreno" value={formatMoeda(precoPorTerreno)} />
            <StatCard
              label="Valor mensal calculado"
              value={formatMoeda(calcularMensalidade(resumoTopografos.terrenosTotal, precoPorTerreno))}
            />
          </div>
        )}
      </div>
    </Layout>
  );
}
