/**
 * src/pages/Topografos.tsx
 *
 * ETAPA TOPÓGRAFOS -- visão administrativa de Topógrafo -> Cliente ->
 * Terreno (ver TopografoDetalhe.tsx para o detalhe de um topógrafo).
 * Mesmo padrão visual/estrutural de Usuarios.tsx (busca com debounce,
 * tabela, modal de criação) -- nada de componente/lib novo além do
 * estritamente necessário (formatMoeda em lib/format.ts e
 * lib/pricing.ts para a regra de mensalidade).
 *
 * Endpoints usados (ver relatório da etapa -- ainda NÃO existem no
 * Backend, esta tela já fica pronta pra quando existirem):
 *   GET  /admin/topografos?busca=      -- lista com clientesCount/terrenosCount
 *   POST /admin/topografos             -- criação (mesmos campos do scripts/createTopografo.cjs)
 *
 * Enquanto não existirem, a tela mostra um aviso claro (não uma tela
 * branca nem um erro genérico) distinguindo "endpoint ainda não
 * implementado" (404) de um erro de verdade do Backend.
 */
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { StatusBadge } from "../components/ui";
import { api, classificarErro } from "../lib/api";
import { formatMoeda } from "../lib/format";
import { calcularMensalidade, obterPrecoPorTerreno } from "../lib/pricing";

type TopografoResumo = {
  id: number;
  nome: string;
  email: string;
  status?: "ativo" | "inativo";
  plano?: string | null;
  clientesCount?: number;
  terrenosCount?: number;
};

export function Topografos() {
  const navigate = useNavigate();
  const [topografos, setTopografos] = useState<TopografoResumo[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [endpointPendente, setEndpointPendente] = useState(false);
  const [mostrarNovo, setMostrarNovo] = useState(false);

  const precoPorTerreno = obterPrecoPorTerreno();

  function carregar() {
    setCarregando(true);
    setErro(null);
    setEndpointPendente(false);

    const params = new URLSearchParams();
    if (busca) params.set("busca", busca);

    api
      .get(`/admin/topografos?${params.toString()}`)
      .then((data) => setTopografos(Array.isArray(data) ? data : []))
      .catch((err) => {
        const { mensagem, endpointPendente: pendente } = classificarErro(err);
        if (pendente) {
          setEndpointPendente(true);
        } else {
          setErro(mensagem);
        }
      })
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  return (
    <Layout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-vertente-dark">Topógrafos</h1>
          <p className="mt-1 text-sm text-vertente-medium">
            Topógrafos cadastrados, seus clientes/terrenos e a mensalidade calculada.
          </p>
        </div>
        <button
          onClick={() => setMostrarNovo(true)}
          className="rounded-lg bg-vertente px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-vertente-dark"
        >
          + Novo Topógrafo
        </button>
      </div>

      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome ou e-mail..."
        className="input mt-6 max-w-sm"
      />

      {endpointPendente && (
        <p className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Este recurso depende de um endpoint administrativo que ainda não existe no
          Backend (GET /admin/topografos). Veja o relatório desta etapa para os detalhes.
        </p>
      )}

      {erro && (
        <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>
      )}

      {carregando && !endpointPendente && !erro && (
        <p className="mt-6 text-sm text-vertente-medium">Carregando...</p>
      )}

      {!carregando && !endpointPendente && !erro && (
        <div className="mt-6 overflow-hidden rounded-xl2 bg-white shadow-card">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-vertente-bg text-vertente-medium">
                <th className="px-6 py-3 font-medium">Topógrafo</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Clientes</th>
                <th className="px-6 py-3 font-medium">Terrenos</th>
                <th className="px-6 py-3 font-medium">Preço/Terreno</th>
                <th className="px-6 py-3 font-medium">Mensalidade</th>
              </tr>
            </thead>
            <tbody>
              {topografos.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-vertente-medium">
                    Nenhum topógrafo encontrado.
                  </td>
                </tr>
              )}

              {topografos.map((t) => {
                const terrenos = t.terrenosCount ?? 0;
                return (
                  <tr
                    key={t.id}
                    onClick={() => navigate(`/topografos/${t.id}`)}
                    className="cursor-pointer border-b border-vertente-bg/60 last:border-0 hover:bg-vertente-bg/40"
                  >
                    <td className="px-6 py-3">
                      <p className="font-medium text-vertente-ink">{t.nome}</p>
                      <p className="text-xs text-vertente-medium">{t.email}</p>
                    </td>
                    <td className="px-6 py-3">
                      <StatusBadge status={t.status === "inativo" ? "inativo" : "ativo"} />
                    </td>
                    <td className="px-6 py-3">{t.clientesCount ?? 0}</td>
                    <td className="px-6 py-3">{terrenos}</td>
                    <td className="px-6 py-3">{formatMoeda(precoPorTerreno)}</td>
                    <td className="px-6 py-3 font-medium text-vertente-dark">
                      {formatMoeda(calcularMensalidade(terrenos, precoPorTerreno))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {mostrarNovo && (
        <NovoTopografoModal onClose={() => setMostrarNovo(false)} onCriado={carregar} />
      )}
    </Layout>
  );
}

function NovoTopografoModal({
  onClose,
  onCriado,
}: {
  onClose: () => void;
  onCriado: () => void;
}) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [plano, setPlano] = useState("");
  const [limiteTerrenos, setLimiteTerrenos] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [endpointPendente, setEndpointPendente] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEndpointPendente(false);

    if (!nome.trim() || !email.trim() || !senha.trim()) {
      setErro("Nome, e-mail e senha são obrigatórios.");
      return;
    }

    setSalvando(true);
    try {
      await api.post("/admin/topografos", {
        nome: nome.trim(),
        email: email.trim(),
        senha,
        plano: plano.trim() || null,
        limite_terrenos: limiteTerrenos.trim() ? Number(limiteTerrenos) : null,
      });
      onCriado();
      onClose();
    } catch (err) {
      const { mensagem, endpointPendente: pendente } = classificarErro(err);
      if (pendente) {
        setEndpointPendente(true);
      } else {
        setErro(mensagem);
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 px-4">
      <form
        onSubmit={salvar}
        className="w-full max-w-md rounded-xl2 bg-white p-6 shadow-soft"
      >
        <h2 className="mb-4 text-base font-semibold text-vertente-dark">Novo Topógrafo</h2>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-medium text-vertente-ink">Nome</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className="input" />
        </label>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-medium text-vertente-ink">E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
        </label>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-medium text-vertente-ink">Senha</span>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="input"
          />
        </label>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-medium text-vertente-ink">
            Plano <span className="font-normal text-vertente-medium">(opcional)</span>
          </span>
          <input value={plano} onChange={(e) => setPlano(e.target.value)} className="input" />
        </label>

        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-medium text-vertente-ink">
            Limite de terrenos <span className="font-normal text-vertente-medium">(opcional)</span>
          </span>
          <input
            type="number"
            min={0}
            value={limiteTerrenos}
            onChange={(e) => setLimiteTerrenos(e.target.value)}
            className="input"
          />
        </label>

        {endpointPendente && (
          <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            O Backend ainda não tem um endpoint para criar topógrafos pelo painel
            (POST /admin/topografos). Por enquanto, cadastre pelo terminal do servidor
            com{" "}
            <code className="rounded bg-vertente-bg px-1 py-0.5">
              node src/scripts/createTopografo.cjs "Nome" email@exemplo.com "senha"
            </code>
            .
          </p>
        )}

        {erro && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-vertente-medium hover:bg-vertente-bg"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando}
            className="rounded-lg bg-vertente px-4 py-2 text-sm font-medium text-white hover:bg-vertente-dark disabled:opacity-60"
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}
