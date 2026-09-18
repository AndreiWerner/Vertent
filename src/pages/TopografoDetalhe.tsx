/**
 * src/pages/TopografoDetalhe.tsx
 *
 * ETAPA TOPÓGRAFOS -- detalhe de um topógrafo: informações, estatísticas
 * (clientes/terrenos/mensalidade) e a lista de clientes, com os
 * terrenos de cada cliente abertos sob demanda (evita precisar de uma
 * quarta rota/página só para uma tabela de terrenos).
 *
 * Endpoints usados (ainda NÃO existem no Backend -- ver relatório):
 *   GET /admin/topografos/:id                    -- info + estatísticas
 *   GET /admin/topografos/:id/clientes            -- clientes do topógrafo
 *   GET /admin/clientes/:clienteId/terrenos       -- terrenos de um cliente
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Layout } from "../components/Layout";
import { StatCard, StatusBadge } from "../components/ui";
import { api, classificarErro } from "../lib/api";
import { formatArea, formatMetros, formatMoeda } from "../lib/format";
import { calcularMensalidade, obterPrecoPorTerreno } from "../lib/pricing";

type TopografoDetalhe = {
  id: number;
  nome: string;
  email: string;
  status?: "ativo" | "inativo";
  plano?: string | null;
  clientesCount?: number;
  terrenosCount?: number;
};

type Cliente = {
  id: number;
  nome: string;
  cpf?: string | null;
  status?: "ativo" | "inativo";
  terrenosCount?: number;
};

type Terreno = {
  id: number;
  matricula: string;
  area?: number | string | null;
  area_unidade?: string | null;
  perimetro?: number | string | null;
  altura_max?: number | string | null;
  altura_min?: number | string | null;
  status?: "ativo" | "inativo";
};

export function TopografoDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [topografo, setTopografo] = useState<TopografoDetalhe | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [endpointPendente, setEndpointPendente] = useState(false);

  const precoPorTerreno = obterPrecoPorTerreno();

  useEffect(() => {
    if (!id) return;
    setCarregando(true);
    setErro(null);
    setEndpointPendente(false);

    Promise.all([api.get(`/admin/topografos/${id}`), api.get(`/admin/topografos/${id}/clientes`)])
      .then(([infoTopografo, listaClientes]) => {
        setTopografo(infoTopografo);
        setClientes(Array.isArray(listaClientes) ? listaClientes : []);
      })
      .catch((err) => {
        const { mensagem, endpointPendente: pendente } = classificarErro(err);
        if (pendente) setEndpointPendente(true);
        else setErro(mensagem);
      })
      .finally(() => setCarregando(false));
  }, [id]);

  return (
    <Layout>
      <button
        onClick={() => navigate("/topografos")}
        className="mb-4 text-sm font-medium text-vertente-medium hover:text-vertente-dark"
      >
        ← Voltar para Topógrafos
      </button>

      {carregando && <p className="text-sm text-vertente-medium">Carregando...</p>}

      {endpointPendente && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Este recurso depende de endpoints administrativos que ainda não existem no
          Backend (GET /admin/topografos/:id e GET /admin/topografos/:id/clientes). Veja o
          relatório desta etapa para os detalhes.
        </p>
      )}

      {erro && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>
      )}

      {topografo && !carregando && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-vertente-dark">{topografo.nome}</h1>
              <p className="mt-1 text-sm text-vertente-medium">{topografo.email}</p>
            </div>
            <StatusBadge status={topografo.status === "inativo" ? "inativo" : "ativo"} />
          </div>

          {topografo.plano && (
            <p className="mt-2 text-sm text-vertente-medium">
              Plano: <span className="font-medium text-vertente-ink">{topografo.plano}</span>
            </p>
          )}

          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Clientes" value={topografo.clientesCount ?? clientes.length} />
            <StatCard label="Terrenos" value={topografo.terrenosCount ?? 0} />
            <StatCard label="Preço/terreno" value={formatMoeda(precoPorTerreno)} />
            <StatCard
              label="Mensalidade calculada"
              value={formatMoeda(calcularMensalidade(topografo.terrenosCount ?? 0, precoPorTerreno))}
            />
          </div>

          <div className="mt-8 overflow-hidden rounded-xl2 bg-white shadow-card">
            <div className="border-b border-vertente-bg px-6 py-4">
              <h2 className="text-base font-semibold text-vertente-dark">Clientes</h2>
            </div>

            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-vertente-bg text-vertente-medium">
                  <th className="px-6 py-3 font-medium">Nome</th>
                  <th className="px-6 py-3 font-medium">CPF</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Terrenos</th>
                </tr>
              </thead>
              <tbody>
                {clientes.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-vertente-medium">
                      Nenhum cliente cadastrado para este topógrafo.
                    </td>
                  </tr>
                )}
                {clientes.map((c) => (
                  <ClienteLinha key={c.id} cliente={c} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Layout>
  );
}

function ClienteLinha({ cliente }: { cliente: Cliente }) {
  const [aberto, setAberto] = useState(false);
  const [terrenos, setTerrenos] = useState<Terreno[] | null>(null);
  const [carregandoTerrenos, setCarregandoTerrenos] = useState(false);
  const [erroTerrenos, setErroTerrenos] = useState<string | null>(null);

  function alternar() {
    const vaiAbrir = !aberto;
    setAberto(vaiAbrir);
    if (vaiAbrir && terrenos === null) {
      setCarregandoTerrenos(true);
      setErroTerrenos(null);
      api
        .get(`/admin/clientes/${cliente.id}/terrenos`)
        .then((data) => setTerrenos(Array.isArray(data) ? data : []))
        .catch((err) => setErroTerrenos(classificarErro(err).mensagem))
        .finally(() => setCarregandoTerrenos(false));
    }
  }

  return (
    <>
      <tr
        onClick={alternar}
        className="cursor-pointer border-b border-vertente-bg/60 last:border-0 hover:bg-vertente-bg/40"
      >
        <td className="px-6 py-3">{cliente.nome}</td>
        <td className="px-6 py-3">{cliente.cpf ?? "—"}</td>
        <td className="px-6 py-3">
          <StatusBadge status={cliente.status === "inativo" ? "inativo" : "ativo"} />
        </td>
        <td className="px-6 py-3">{cliente.terrenosCount ?? "—"}</td>
      </tr>

      {aberto && (
        <tr className="border-b border-vertente-bg/60 last:border-0 bg-vertente-bg/20">
          <td colSpan={4} className="px-6 py-4">
            {carregandoTerrenos && (
              <p className="text-sm text-vertente-medium">Carregando terrenos...</p>
            )}
            {erroTerrenos && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erroTerrenos}</p>
            )}
            {terrenos && terrenos.length === 0 && !carregandoTerrenos && (
              <p className="text-sm text-vertente-medium">
                Nenhum terreno cadastrado para este cliente.
              </p>
            )}
            {terrenos && terrenos.length > 0 && (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-vertente-medium">
                    <th className="pb-2 pr-4 font-medium">Matrícula</th>
                    <th className="pb-2 pr-4 font-medium">Área</th>
                    <th className="pb-2 pr-4 font-medium">Perímetro</th>
                    <th className="pb-2 pr-4 font-medium">Cota mín.</th>
                    <th className="pb-2 pr-4 font-medium">Cota máx.</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {terrenos.map((t) => (
                    <tr key={t.id} className="border-t border-vertente-bg">
                      <td className="py-2 pr-4">{t.matricula}</td>
                      <td className="py-2 pr-4">{formatArea(t.area, t.area_unidade)}</td>
                      <td className="py-2 pr-4">{formatMetros(t.perimetro)}</td>
                      <td className="py-2 pr-4">{formatMetros(t.altura_min)}</td>
                      <td className="py-2 pr-4">{formatMetros(t.altura_max)}</td>
                      <td className="py-2">
                        <StatusBadge status={t.status === "inativo" ? "inativo" : "ativo"} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
