/**
 * src/pages/topografo/ClienteDetalhe.tsx
 *
 * Terrenos de UM cliente do topógrafo logado, com formulário de
 * cadastro de novo terreno (upload de GLB). Versão simplificada do
 * fluxo de NovoTerreno.tsx do admin -- sem planta/memorial/
 * confrontantes (isso é a etapa "Planta/Memorial do Topógrafo",
 * ainda pendente no roadmap), só os dados técnicos + o modelo 3D.
 *
 * Endpoints usados (controllers/topografo/*.js):
 *   GET  /topografo/me/clientes/:clienteId                 -- dados do cliente
 *   GET  /topografo/me/clientes/:clienteId/terrenos         -- terrenos dele
 *   POST /topografo/me/clientes/:clienteId/terrenos (multipart)
 */
import { useEffect, useState, type FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "../../components/Layout";
import { GlbDropzone } from "../../components/GlbDropzone";
import { api, ApiError } from "../../lib/api";
import { formatArea, formatMetros, opcoesUnidadeArea } from "../../lib/format";

type Cliente = {
  id: number;
  nome: string;
  cpf?: string | null;
  email?: string | null;
  telefone?: string | null;
};

type Terreno = {
  id: number;
  matricula: string;
  area?: number | string | null;
  area_unidade?: string | null;
  perimetro?: number | string | null;
  altura_max?: number | string | null;
  altura_min?: number | string | null;
};

export function ClienteDetalhe() {
  const { clienteId } = useParams();
  const navigate = useNavigate();

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [terrenos, setTerrenos] = useState<Terreno[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [mostrarNovo, setMostrarNovo] = useState(false);

  function carregar() {
    if (!clienteId) return;
    setCarregando(true);
    setErro(null);

    Promise.all([
      api.get(`/topografo/me/clientes/${clienteId}`),
      api.get(`/topografo/me/clientes/${clienteId}/terrenos`),
    ])
      .then(([dadosCliente, listaTerrenos]) => {
        setCliente(dadosCliente);
        setTerrenos(Array.isArray(listaTerrenos) ? listaTerrenos : []);
      })
      .catch((err) => setErro(err instanceof ApiError ? err.message : "Erro ao carregar cliente"))
      .finally(() => setCarregando(false));
  }

  useEffect(carregar, [clienteId]);

  return (
    <Layout>
      <button
        onClick={() => navigate("/meus-clientes")}
        className="mb-4 text-sm font-medium text-vertente-medium hover:text-vertente-dark"
      >
        ← Voltar para Meus Clientes
      </button>

      {carregando && <p className="text-sm text-vertente-medium">Carregando...</p>}

      {erro && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>
      )}

      {cliente && !carregando && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-vertente-dark">{cliente.nome}</h1>
              <p className="mt-1 text-sm text-vertente-medium">
                {cliente.cpf ?? "CPF não informado"}
                {cliente.email ? ` · ${cliente.email}` : ""}
              </p>
            </div>
            <button
              onClick={() => setMostrarNovo(true)}
              className="rounded-lg bg-vertente px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-vertente-dark"
            >
              + Novo Terreno
            </button>
          </div>

          <div className="mt-8 overflow-hidden rounded-xl2 bg-white shadow-card">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-vertente-bg text-vertente-medium">
                  <th className="px-6 py-3 font-medium">Matrícula</th>
                  <th className="px-6 py-3 font-medium">Área</th>
                  <th className="px-6 py-3 font-medium">Perímetro</th>
                  <th className="px-6 py-3 font-medium">Cota mín.</th>
                  <th className="px-6 py-3 font-medium">Cota máx.</th>
                </tr>
              </thead>
              <tbody>
                {terrenos.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-vertente-medium">
                      Nenhum terreno cadastrado para este cliente.
                    </td>
                  </tr>
                )}
                {terrenos.map((t) => (
                  <tr key={t.id} className="border-b border-vertente-bg/60 last:border-0">
                    <td className="px-6 py-3 font-medium text-vertente-ink">{t.matricula}</td>
                    <td className="px-6 py-3">{formatArea(t.area, t.area_unidade)}</td>
                    <td className="px-6 py-3">{formatMetros(t.perimetro)}</td>
                    <td className="px-6 py-3">{formatMetros(t.altura_min)}</td>
                    <td className="px-6 py-3">{formatMetros(t.altura_max)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {mostrarNovo && cliente && (
        <NovoTerrenoModal
          clienteId={cliente.id}
          onClose={() => setMostrarNovo(false)}
          onCriado={carregar}
        />
      )}
    </Layout>
  );
}

function NovoTerrenoModal({
  clienteId,
  onClose,
  onCriado,
}: {
  clienteId: number;
  onClose: () => void;
  onCriado: () => void;
}) {
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [matricula, setMatricula] = useState("");
  const [area, setArea] = useState("");
  const [areaUnidade, setAreaUnidade] = useState("ha");
  const [perimetro, setPerimetro] = useState("");
  const [alturaMax, setAlturaMax] = useState("");
  const [alturaMin, setAlturaMin] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!nome.trim() || !cpf.trim() || !matricula.trim()) {
      setErro("Nome, CPF e matrícula são obrigatórios.");
      return;
    }
    if (!file) {
      setErro("Selecione um arquivo GLB.");
      return;
    }

    const formData = new FormData();
    formData.append("nome", nome.trim());
    formData.append("cpf", cpf.trim());
    formData.append("matricula", matricula.trim());
    formData.append("area", area);
    formData.append("area_unidade", areaUnidade);
    formData.append("perimetro", perimetro);
    formData.append("altura_max", alturaMax);
    formData.append("altura_min", alturaMin);
    formData.append("glb", file);

    setEnviando(true);
    setProgress(0);
    try {
      await api.uploadForm(
        `/topografo/me/clientes/${clienteId}/terrenos`,
        "POST",
        formData,
        setProgress
      );
      onCriado();
      onClose();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Erro ao cadastrar terreno.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-y-auto bg-black/40 px-4 py-8">
      <form
        onSubmit={salvar}
        className="w-full max-w-lg rounded-xl2 bg-white p-6 shadow-soft"
      >
        <h2 className="mb-4 text-base font-semibold text-vertente-dark">Novo Terreno</h2>
        <p className="mb-4 text-xs text-vertente-medium">
          Estes dados também cadastram o acesso do dono do terreno ao aplicativo
          (login por CPF + matrícula).
        </p>

        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 block">
            <span className="mb-1 block text-sm font-medium text-vertente-ink">
              Nome do proprietário
            </span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} className="input" />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-vertente-ink">CPF</span>
            <input
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              placeholder="Somente números"
              className="input"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-vertente-ink">Matrícula</span>
            <input
              value={matricula}
              onChange={(e) => setMatricula(e.target.value)}
              className="input"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-vertente-ink">Área</span>
            <div className="flex gap-2">
              <input value={area} onChange={(e) => setArea(e.target.value)} className="input" />
              <select
                value={areaUnidade}
                onChange={(e) => setAreaUnidade(e.target.value)}
                className="input w-20"
              >
                {opcoesUnidadeArea(areaUnidade).map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-vertente-ink">Perímetro</span>
            <input
              value={perimetro}
              onChange={(e) => setPerimetro(e.target.value)}
              className="input"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-vertente-ink">
              Cota máxima
            </span>
            <input
              value={alturaMax}
              onChange={(e) => setAlturaMax(e.target.value)}
              className="input"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-vertente-ink">
              Cota mínima
            </span>
            <input
              value={alturaMin}
              onChange={(e) => setAlturaMin(e.target.value)}
              className="input"
            />
          </label>
        </div>

        <div className="mt-4">
          <span className="mb-1 block text-sm font-medium text-vertente-ink">
            Modelo 3D (GLB)
          </span>
          <GlbDropzone file={file} onSelect={setFile} progress={progress} />
        </div>

        {erro && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-vertente-medium hover:bg-vertente-bg"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando}
            className="rounded-lg bg-vertente px-4 py-2 text-sm font-medium text-white hover:bg-vertente-dark disabled:opacity-60"
          >
            {enviando ? `Enviando... ${progress ?? 0}%` : "Cadastrar terreno"}
          </button>
        </div>
      </form>
    </div>
  );
}
